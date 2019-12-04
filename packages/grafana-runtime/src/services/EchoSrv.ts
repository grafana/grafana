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

export interface EchoSrv {
  flush(): void;
  addBackend(backend: EchoBackend): void;
  addEvent<T extends EchoEvent>(event: Omit<T, 'meta' | 'ts'>, meta?: {}): void;
  setMeta(meta: Partial<EchoMeta>): void;
}

let singletonInstance: EchoSrv;

export function setEchoSrv(instance: EchoSrv) {
  singletonInstance = instance;
}

export function getEchoSrv(): EchoSrv {
  return singletonInstance;
}

export const registerEchoBackend = (backend: EchoBackend) => {
  getEchoSrv().addBackend(backend);
};

export const setEchoMeta = (meta: EchoMeta) => {
  getEchoSrv().setMeta(meta);
};
