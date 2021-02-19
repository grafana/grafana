interface SizeMeta {
  width: number;
  height: number;
}

export interface EchoMeta {
  screenSize: SizeMeta;
  windowSize: SizeMeta;
  userAgent: string;
  url?: string;
  /**
   * A unique browser session
   */
  sessionId: string;
  userLogin: string;
  userId: number;
  userSignedIn: boolean;
  /**
   * A millisecond epoch
   */
  ts: number;
  /**
   * A highres timestamp since navigation start
   */
  timeSinceNavigationStart: number;
}

export interface EchoBackend<T extends EchoEvent = any, O = any> {
  options: O;
  supportedEvents: EchoEventType[];
  flush: () => void;
  addEvent: (event: T) => void;
}

export interface EchoEvent<T extends EchoEventType = any, P = any> {
  type: EchoEventType;
  payload: P;
  meta: EchoMeta;
}

export enum EchoEventType {
  Performance = 'performance',
  MetaAnalytics = 'meta-analytics',
}

export interface EchoSrv {
  flush(): void;
  addBackend(backend: EchoBackend): void;
  addEvent<T extends EchoEvent>(event: Omit<T, 'meta'>, meta?: {}): void;
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
