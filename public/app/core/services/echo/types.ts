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

export interface EchoConsumer<T extends EchoEvent = any, O = any> {
  options: O;
  supportedEvents?: string[];
  flush: () => void;
  consume: (event: T) => void;
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

export interface EchoConsumerCtor<T extends EchoEvent, O> {
  new (echoInstance: EchoSrv, opts: O): EchoConsumer<T, O>;
}

export interface EchoSrv {
  flush(): void;
  addConsumer(consumer: EchoConsumer): void;
  consumeEvent<T extends EchoEvent>(event: Omit<T, 'meta' | 'ts'>, meta?: {}): void;
  setMeta(meta: Partial<EchoMeta>): void;
}
