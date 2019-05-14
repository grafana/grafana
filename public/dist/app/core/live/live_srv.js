import _ from 'lodash';
import config from 'app/core/config';
import { Observable } from 'rxjs';
var LiveSrv = /** @class */ (function () {
    function LiveSrv() {
        this.observers = {};
    }
    LiveSrv.prototype.getWebSocketUrl = function () {
        var l = window.location;
        return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + config.appSubUrl + '/ws';
    };
    LiveSrv.prototype.getConnection = function () {
        var _this = this;
        if (this.initPromise) {
            return this.initPromise;
        }
        if (this.conn && this.conn.readyState === 1) {
            return Promise.resolve(this.conn);
        }
        this.initPromise = new Promise(function (resolve, reject) {
            console.log('Live: connecting...');
            _this.conn = new WebSocket(_this.getWebSocketUrl());
            _this.conn.onclose = function (evt) {
                console.log('Live: websocket onclose', evt);
                reject({ message: 'Connection closed' });
                _this.initPromise = null;
                setTimeout(_this.reconnect.bind(_this), 2000);
            };
            _this.conn.onmessage = function (evt) {
                _this.handleMessage(evt.data);
            };
            _this.conn.onerror = function (evt) {
                _this.initPromise = null;
                reject({ message: 'Connection error' });
                console.log('Live: websocket error', evt);
            };
            _this.conn.onopen = function (evt) {
                console.log('opened');
                _this.initPromise = null;
                resolve(_this.conn);
            };
        });
        return this.initPromise;
    };
    LiveSrv.prototype.handleMessage = function (message) {
        message = JSON.parse(message);
        if (!message.stream) {
            console.log('Error: stream message without stream!', message);
            return;
        }
        var observer = this.observers[message.stream];
        if (!observer) {
            this.removeObserver(message.stream, null);
            return;
        }
        observer.next(message);
    };
    LiveSrv.prototype.reconnect = function () {
        var _this = this;
        // no need to reconnect if no one cares
        if (_.keys(this.observers).length === 0) {
            return;
        }
        console.log('LiveSrv: Reconnecting');
        this.getConnection().then(function (conn) {
            _.each(_this.observers, function (value, key) {
                _this.send({ action: 'subscribe', stream: key });
            });
        });
    };
    LiveSrv.prototype.send = function (data) {
        this.conn.send(JSON.stringify(data));
    };
    LiveSrv.prototype.addObserver = function (stream, observer) {
        var _this = this;
        this.observers[stream] = observer;
        this.getConnection().then(function (conn) {
            _this.send({ action: 'subscribe', stream: stream });
        });
    };
    LiveSrv.prototype.removeObserver = function (stream, observer) {
        var _this = this;
        console.log('unsubscribe', stream);
        delete this.observers[stream];
        this.getConnection().then(function (conn) {
            _this.send({ action: 'unsubscribe', stream: stream });
        });
    };
    LiveSrv.prototype.subscribe = function (streamName) {
        var _this = this;
        console.log('LiveSrv.subscribe: ' + streamName);
        return Observable.create(function (observer) {
            _this.addObserver(streamName, observer);
            return function () {
                _this.removeObserver(streamName, observer);
            };
        });
        // return this.init().then(() =>  {
        //   this.send({action: 'subscribe', stream: name});
        // });
    };
    return LiveSrv;
}());
export { LiveSrv };
var instance = new LiveSrv();
export { instance as liveSrv };
//# sourceMappingURL=live_srv.js.map