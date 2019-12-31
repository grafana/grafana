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
  subscribe<T = any>(stream: string): Observable<StreamEvent<T>>;

  /**
   * Send a command to an open stream
   */
  write<T = any>(stream: string, action: string, args?: any): Promise<T>;
}

let singletonInstance: WebStreamSrv;

export function setWebStreamSrv(instance: WebStreamSrv) {
  singletonInstance = instance;
}

export function getWebStreamSrv(): WebStreamSrv {
  return singletonInstance;
}
