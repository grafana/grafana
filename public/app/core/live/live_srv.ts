import _ from 'lodash';
import config from 'app/core/config';

import { Observable } from 'rxjs';

export class LiveSrv {
  conn: any;
  observers: any;
  initPromise: any;

  constructor() {
    this.observers = {};
  }

  getWebSocketUrl() {
    const l = window.location;
    return (l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + config.appSubUrl + '/ws';
  }

  getConnection() {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.conn && this.conn.readyState === 1) {
      return Promise.resolve(this.conn);
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log('Live: connecting...');
      this.conn = new WebSocket(this.getWebSocketUrl());

      this.conn.onclose = evt => {
        console.log('Live: websocket onclose', evt);
        reject({ message: 'Connection closed' });

        this.initPromise = null;
        setTimeout(this.reconnect.bind(this), 2000);
      };

      this.conn.onmessage = evt => {
        this.handleMessage(evt.data);
      };

      this.conn.onerror = evt => {
        this.initPromise = null;
        reject({ message: 'Connection error' });
        console.log('Live: websocket error', evt);
      };

      this.conn.onopen = evt => {
        console.log('opened');
        this.initPromise = null;
        resolve(this.conn);
      };
    });

    return this.initPromise;
  }

  handleMessage(message) {
    message = JSON.parse(message);

    if (!message.stream) {
      console.log('Error: stream message without stream!', message);
      return;
    }

    const observer = this.observers[message.stream];
    if (!observer) {
      this.removeObserver(message.stream, null);
      return;
    }

    observer.next(message);
  }

  reconnect() {
    // no need to reconnect if no one cares
    if (_.keys(this.observers).length === 0) {
      return;
    }

    console.log('LiveSrv: Reconnecting');

    this.getConnection().then(conn => {
      _.each(this.observers, (value, key) => {
        this.send({ action: 'subscribe', stream: key });
      });
    });
  }

  send(data) {
    this.conn.send(JSON.stringify(data));
  }

  addObserver(stream, observer) {
    this.observers[stream] = observer;

    this.getConnection().then(conn => {
      this.send({ action: 'subscribe', stream: stream });
    });
  }

  removeObserver(stream, observer) {
    console.log('unsubscribe', stream);
    delete this.observers[stream];

    this.getConnection().then(conn => {
      this.send({ action: 'unsubscribe', stream: stream });
    });
  }

  subscribe(streamName) {
    console.log('LiveSrv.subscribe: ' + streamName);

    return Observable.create(observer => {
      this.addObserver(streamName, observer);

      return () => {
        this.removeObserver(streamName, observer);
      };
    });

    // return this.init().then(() =>  {
    //   this.send({action: 'subscribe', stream: name});
    // });
  }
}

const instance = new LiveSrv();
export { instance as liveSrv };
