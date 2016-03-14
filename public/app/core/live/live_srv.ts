///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import coreModule from 'app/core/core_module';

export class LiveSrv {
  conn: any;
  initPromise: any;

  getWebSocketUrl() {
    var l = window.location;
    return ((l.protocol === "https:") ? "wss://" : "ws://") + l.host + config.appSubUrl + '/ws';
  }

  init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.conn && this.conn.readyState === 1) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log('Live: connecting...');
      this.conn = new WebSocket(this.getWebSocketUrl());

      this.conn.onclose = function(evt) {
        reject({message: 'Connection closed'});
      };

      this.conn.onmessage = function(evt) {
        console.log("Live: message received:", evt.data);
      };

      this.conn.onopen = function(evt) {
        console.log('Live: connection open');
        resolve();
      };
    });

    return this.initPromise;
  }

  send(data) {
    this.conn.send(JSON.stringify(data));
  }

  subscribe(name) {
    return this.init().then(() =>  {
      this.send({action: 'subscribe', stream: name});
    });
  }

}

var instance = new LiveSrv();
export {instance as liveSrv};
