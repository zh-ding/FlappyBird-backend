const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const uuid = require('node-uuid');

const server = new https.createServer({
    cert: fs.readFileSync('./certificate/chained.pem'),
    key: fs.readFileSync('./certificate/domain.key')
});

const wss = new WebSocket.Server({ server });

let uuid_ws = {};
let not_matched = [];
let opponent = {};
let dead = {};

wss.on('connection', function connection(ws){
    ws.on('message', function incoming(message){
        let d = JSON.parse(message);
        console.log(d);
        if(d.type === 'request')
            deal_with_request(ws, d);
        else if(d.type === 'jump')
            deal_with_jump(ws, d);
        else if(d.type === 'score')
            deal_with_score(ws, d);
        else if(d.type === 'die')
            deal_with_die(ws, d);
        else if(d.type === 'connect')
            deal_with_connect(ws, d);
        else if(d.type === 'close')
            deal_with_close(ws, d);
    });
});

function deal_with_request(ws, d){
    ws.uuid = uuid.v4();
    ws.nickName = d.nickName;
    ws.avatarUrl = d.avatarUrl;
    ws.isAlive = true;
    ws.opponent = 'null';
    uuid_ws[ws.uuid] = ws;
    console.log(not_matched.length);
    while(not_matched.length > 0){
        let uuid = not_matched[0];
        if(!uuid_ws[uuid]){
            not_matched.shift();
            continue;
        }
        let res = {};
        res['type'] = 'matched';
        res['nickName'] = uuid_ws[uuid].nickName;
        res['avatarUrl'] = uuid_ws[uuid].avatarUrl;
        res['uuid'] = uuid;
        try{
            ws.send(JSON.stringify(res));
        }catch(e){
            console.log(e);
            break;
        }
        res['type'] = 'matched';
        res['nickName'] = ws.nickName;
        res['avatarUrl'] = ws.avatarUrl;
        res['uuid'] = ws.uuid;
        try{
            uuid_ws[uuid].send(JSON.stringify(res));
            not_matched.shift();
            console.log('not_matched: ' + not_matched.length);
            ws.opponent = uuid;
            uuid_ws[uuid].opponent = ws.uuid;
            opponent[uuid] = ws.uuid;
            opponent[ws.uuid] = uuid;
            break;
        }catch(e){
            console.log(e);
            not_matched.shift();
            continue;
        }
    }
    console.log('_if: ' + not_matched.length);
    if(ws && ws.opponent === 'null')
        not_matched.push(ws.uuid);
    console.log('if_: ' + not_matched.length);
}

function deal_with_jump(ws, d){
    //uuid_ws[d.uuid] = ws;
    let res = {};
    res['type'] = 'jump';
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_connect(ws, d){
    uuid_ws[d.uuid] = ws;
    dead[d.uuid] = false;
}

function deal_with_score(ws, d){
    let res = {};
    res['type'] = 'score';
    res['score'] = d.score;
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
}

function deal_with_die(ws, d){
    dead[d.uuid] = true;
    console.log(d.uuid);
    let res = {};
    res['type'] = 'die';
    try{
        uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
    }catch(e){
        console.log(e);
    }
    if(dead[opponent[d.uuid]]){
        res['type'] = 'finish';
        try{
            ws.send(JSON.stringify(res));
            uuid_ws[opponent[d.uuid]].send(JSON.stringify(res));
        }catch(e){
            console.log(e);
        }
    }
}

function deal_with_close(ws, d){
    delete uuid_ws[ws.uuid];
    let i = not_matched.indexOf(ws.uuid);
    console.log('_not_matched: ' + not_matched);
    if(i > -1)
        not_matched.splice(i, 1);
    console.log('not_matched_: ' + not_matched);
    ws.terminate();
}

server.listen(443);

function noop() {}
 
function heartbeat() {
    this.isAlive = true;
}
 
wss.on('connection', function connection(ws) {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
});

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
       if (ws.isAlive === false){
           console.log(ws.uuid + ' ' + ws.nickName + ' terminated.');
           return ws.terminate();
       }
       console.log('testing ' + ws.nickName);
       ws.isAlive = false;
       ws.ping(noop);
    });
}, 20000);
