import { Observable, Subject } from 'rxjs';
import { finalize, share } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebStreamSrv, StreamEvent } from '@grafana/runtime';

// Incrementing ID for commands
// The value is unique within the connection, not globally
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
    console.warn('onMessage', evt);

    const stream = this.streams.get(evt.stream);
    const action = (evt as any).__action;
    if (action) {
      const cmd = (evt as any).__cmd;
      if (cmd) {
        const s = this.commands.get(cmd);
        if (!s) {
          console.warn('Missing COMMAND', evt);
          return;
        }
        s.next(evt.stream);
        s.complete();
        this.commands.delete(cmd);
        return;
      }
      console.warn('INTERNAL message', action, evt);
      return;
    }
    if (!stream) {
      console.warn('WebSocket message without stream', evt);
      return;
    }
    stream.lastMessage = Date.now();
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

  private getWebSocket(): WebSocketSubject<StreamEvent> {
    if (!this.socket) {
      this.socket = webSocket('ws://localhost:3000/ws');
      this.socket.subscribe(this.onMessage, this.onError, this.onComplete);
    }
    return this.socket;
  }

  stream<T = any>(stream: string): Observable<StreamEvent<T>> {
    let open = this.streams.get(stream);
    if (!open) {
      const subject = new Subject<StreamEvent>();
      const finalizer = () => {
        console.log('No More listeners', stream);
        this.getWebSocket().next(({
          action: 'unsubscribe',
          stream,
        } as unknown) as StreamEvent);
      };
      subject.pipe(finalize(finalizer), share());
      open = {
        stream,
        subject, // need subject (not observable) so we can send it events
        connected: Date.now(),
        lastMessage: 0,
        messageCount: 0,
      };
      this.streams.set(stream, open);
      this.getWebSocket().next(({
        action: 'subscribe',
        stream,
      } as unknown) as StreamEvent);
    }
    return open.subject.asObservable();
  }

  write<T = any>(stream: string, action: string, body?: any): Observable<T> {
    // Subscribe & unsbuscribe are internal commands
    if (action === 'subscribe' || action === 'unsubscribe') {
      throw new Error('Invalid Action: ' + action);
    }
    const cid = cmdId++;
    const subject = new Subject<T>();
    this.commands.set(cid, subject);
    const cmd = ({
      cid,
      action,
      stream,
      body,
    } as undefined) as StreamEvent;
    console.log('WRITE', cmd);
    this.getWebSocket().next(cmd);
    return subject.asObservable();
  }
}
