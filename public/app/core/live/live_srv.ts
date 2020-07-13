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
      this.conn = new WebSocket(this.getWebSocketUrl());

      this.conn.onclose = (evt: any) => {
        reject({ message: 'Connection closed' });

        this.initPromise = null;
        setTimeout(this.reconnect.bind(this), 2000);
      };

      this.conn.onmessage = (evt: any) => {
        this.handleMessage(evt.data);
      };

      this.conn.onerror = (evt: any) => {
        this.initPromise = null;
        reject({ message: 'Connection error' });
      };

      this.conn.onopen = (evt: any) => {
        this.initPromise = null;
        resolve(this.conn);
      };
    });

    return this.initPromise;
  }

  handleMessage(message: any) {
    message = JSON.parse(message);

    if (!message.stream) {
      console.error('Error: stream message without stream!', message);
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

    this.getConnection().then((conn: any) => {
      _.each(this.observers, (value, key) => {
        this.send({ action: 'subscribe', stream: key });
      });
    });
  }

  send(data: any) {
    this.conn.send(JSON.stringify(data));
  }

  addObserver(stream: any, observer: any) {
    this.observers[stream] = observer;

    this.getConnection().then((conn: any) => {
      this.send({ action: 'subscribe', stream: stream });
    });
  }

  removeObserver(stream: any, observer: any) {
    delete this.observers[stream];

    this.getConnection().then((conn: any) => {
      this.send({ action: 'unsubscribe', stream: stream });
    });
  }

  subscribe(streamName: string) {
    return Observable.create((observer: any) => {
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
