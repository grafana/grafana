import { Observable, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebSocketSrv, WebSocketConnectionOptions, SocketMessage } from '@grafana/runtime';

let counter = 1;

// export interface OpenStream {
//   id:number;
//   stream:string;
//   connected:number;
//   lastMessage:number;
//   messageCount:number;

//   subject:
// }

class OpenStream {
  id = counter++;
  connected = Date.now();
  stream: string;
  subject = new Subject<SocketMessage>();

  lastMessage = 0; // Time
  messageCount = 0; // Count

  constructor() {}
}

export class GrafanaLiveSrv implements WebSocketSrv {
  socket: WebSocketSubject<SocketMessage>;
  pending = new Map<number, OpenStream>();
  streams = new Map<string, OpenStream>();

  onMessage = (msg: SocketMessage) => {
    console.log('message received: ', msg); // Called whenever there is a message from the server.
  };

  onError = (err: any) => {
    console.log('ERROR', err); // Called if at any point WebSocket API signals some kind of error.
  };

  onComplete = () => {
    console.log('web socket closed'); // Called when connection is closed (for whatever reason).
    this.socket = undefined;
  };

  private getWebSocket(): WebSocket {
    if (!this.socket) {
      this.socket = webSocket('ws://localhost:3000/ws');
      this.socket.subscribe(this.onMessage, this.onError, this.onComplete);
    }
    return this.socket;
  }

  subscribe(options: WebSocketConnectionOptions): Observable<SocketMessage> {
    const socket = this.getWebSocket();
    const stream = new OpenStream();

    const msg = {
      key: counter++,
      id: stream.id,
      stream: 'aaaa',
      action: 'subscribe',
      body: 'Hellow World',
    };

    socket.next(msg);

    return stream.subject.asObservable();
  }

  write(msg: SocketMessage): SocketMessage {
    const socket = this.getWebSocket();
    socket.next({
      ...msg,
      key: counter++,
    });

    return {
      stream: 'xxxx',
      body: 'TODO.... actually do this...',
    };
  }
}
