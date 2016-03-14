///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import coreModule from 'app/core/core_module';

export class LiveSrv {
  conn: any;

  init() {
    this.conn = new WebSocket("ws://localhost:3000/ws");
    this.conn.onclose = function(evt) {
      console.log("WebSocket closed");
    };
    this.conn.onmessage = function(evt) {
      console.log("WebSocket message", evt.data);
    };
    this.conn.onopen = function(evt) {
      console.log("Connection opened");
    };
  }

  subscribe(name) {
    if (!this.conn) {
      this.init();
    }
  }

}

var instance = new LiveSrv();
export {instance as liveSrv};
