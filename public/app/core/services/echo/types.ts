interface SizeMeta {
  width: number;
  height: number;
}

export interface EchoMeta {
  screenSize: SizeMeta;
  windowSize: SizeMeta;
  userAgent: string;
  url?: string;
}

export interface EchoBackend<T extends EchoEvent = any, O = any> {
  options: O;
  supportedEvents?: EchoEventType[];
  flush: () => void;
  addEvent: (event: T) => void;
}

export interface EchoEvent<T extends EchoEventType = any, P = any> {
  type: T;
  payload: P;
  meta: EchoMeta;
  ts: number;
}

export enum EchoEventType {
  Performance = 'performance',
}

export interface EchoBackendCtor<T extends EchoEvent, O> {
  new (echoInstance: EchoSrv, opts: O): EchoBackend<T, O>;
}

export interface EchoSrv {
  flush(): void;
  addBackend(backend: EchoBackend): void;
  addEvent<T extends EchoEvent>(event: Omit<T, 'meta' | 'ts'>, meta?: {}): void;
  setMeta(meta: Partial<EchoMeta>): void;
}
