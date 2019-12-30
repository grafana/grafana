import { Observable } from 'rxjs';

export interface SocketMessage<T = any> {
  stream: string; // Unique key for the stream
  time: number; // Message timestamp
  body: T;
}

export interface WebSocketConnectionOptions {
  // will soon be plugin, id + options
  stream: string;
}

export interface WebSocketSrv {
  /**
   * Connect to a stream and recieve messages from it
   */
  subscribe(options: WebSocketConnectionOptions): Observable<SocketMessage>;

  /**
   * Send a message to an open stream
   */
  write(msg: SocketMessage): SocketMessage;
}

let singletonInstance: WebSocketSrv;

export function setWebSocketSrv(instance: WebSocketSrv) {
  singletonInstance = instance;
}

export function getWebSocketSrv(): WebSocketSrv {
  return singletonInstance;
}
