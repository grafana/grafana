import { Observable } from 'rxjs';

/**
 * Events broadcast to everyone listenting to the stream
 */
export interface StreamEvent<T = any> {
  stream: string; // Path to stream (${plugin}/${topic})
  time: number; // Message timestamp
  body: T;
}

export interface WebStreamSrv {
  /**
   * Connect to a stream and recieve all messages from it
   */
  stream<T = any>(channel: string): Observable<StreamEvent<T>>;

  /**
   * Send a command to an open stream, get the response (single)
   */
  write<T = any>(channel: string, action: string, body?: any): Observable<T>;
}

let singletonInstance: WebStreamSrv;

export function setWebStreamSrv(instance: WebStreamSrv) {
  singletonInstance = instance;
}

export function getWebStreamSrv(): WebStreamSrv {
  return singletonInstance;
}
