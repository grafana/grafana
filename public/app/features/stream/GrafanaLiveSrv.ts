import { Observable, Subject, finalize, share } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebStreamSrv, WebSocketConnectionOptions, StreamEvent } from '@grafana/runtime';

// Incrementing ID for commands
let cmdId = 1;

interface OpenStream {
  connected: number;
  stream: string;
  subject: Subject<StreamEvent>;

  lastMessage: number;
  messageCount: number;
}

export class GrafanaLiveSrv implements WebStreamSrv {
  socket: WebSocketSubject<StreamEvent>;
  streams = new Map<string, OpenStream>();
  commands = new Map<number, Subject<any>>();

  onMessage = (evt: StreamEvent) => {
    const stream = this.streams.get(evt.stream);
    const action = (evt as any).__action;
    if (action) {
      const cmd = (evt as any).__cmd;
      if (cmd) {
        const s = commands.remove(cmd);
        if (!s) {
          console.warn('Missing COMMAND', evt);
          return;
        }
      }
      console.warn('INTERNAL message', action, cmd, evt);
      return;
    }
    if (!stream) {
      console.warn('WebSocket message without stream', evt);
      return;
    }
    stream.lastmessage = Date.now();
    stream.messageCount++;
    stream.subject.next(evt);
    console.log('now brodcast: ', evt); // Called whenever there is a message from the server.
  };

  onError = (err: any) => {
    console.log('ERROR', err); // Called if at any point WebSocket API signals some kind of error.
  };

  onComplete = () => {
    console.log('web socket closed'); // Called when connection is closed (for whatever reason).
    this.socket = undefined;

    // TODO cleanup nicely
    this.streams.clear();
    this.commands.clear();
  };

  private getWebSocket(): WebSocket {
    if (!this.socket) {
      this.socket = webSocket('ws://localhost:3000/ws');
      this.socket.subscribe(this.onMessage, this.onError, this.onComplete);
    }
    return this.socket;
  }

  subscribe<T = any>(stream: string): Observable<StreamEvent<T>> {
    let open = this.streams.get(stream);
    if (!open) {
      const subject = new Subject<StreamEvent>();
      const socket = this.getWebSocket();
      const finalizer = () => {
        console.log('No More listeners', stream);
        socket.next({
          action: 'unsubscribe',
          stream,
        });
      };
      open = {
        stream: string,
        subject: subject.pipe(finalize(finalizer), share()),
        connected: Date.now(),
        lastMessage: 0,
        messageCount: 0,
      };
      this.streams.set(stream, open);
      socket.next({
        action: 'subscribe',
        stream,
      });
    }
    return open.subject.asObservable();
  }

  write<T = any>(stream: string, action: string, body?: any): Observable<T> {
    // Subscribe & unsbuscribe are internal commands
    if (action === 'subscribe' || action === 'unsubscribe') {
      throw new Error('Invalid Action: ' + action);
    }
    const cmd = cmdId++;
    const subject = new Subject<T>();
    this.commands.pus(cmd, subject);
    socket.next({
      __cmd: cmd,
      action,
      stream,
      body,
    });
    return subject.asObservable();
  }
}
