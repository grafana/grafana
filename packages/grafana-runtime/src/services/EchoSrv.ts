/**
 *
 * @public
 */
interface SizeMeta {
  width: number;
  height: number;
}

/**
 *
 * @public
 */
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

/**
 *
 * @public
 */
export interface EchoBackend<T extends EchoEvent = any, O = any> {
  options: O;
  supportedEvents: EchoEventType[];
  flush: () => void;
  addEvent: (event: T) => void;
}

/**
 *
 * @public
 */
export interface EchoEvent<T extends EchoEventType = any, P = any> {
  type: EchoEventType;
  payload: P;
  meta: EchoMeta;
}

/**
 *
 * @public
 */
export enum EchoEventType {
  Performance = 'performance',
  MetaAnalytics = 'meta-analytics',
}

/**
 *
 * @public
 */
export interface EchoSrv {
  flush(): void;
  addBackend(backend: EchoBackend): void;
  addEvent<T extends EchoEvent>(event: Omit<T, 'meta'>, meta?: {}): void;
}

let singletonInstance: EchoSrv;

/**
 * Used during startup by Grafana to set the EchoSrv so it is available
 * via the the {@link getEchoSrv()} to the rest of the application.
 *
 * @internal
 */
export function setEchoSrv(instance: EchoSrv) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link EchoSrv} that can be used to report events to
 * registered echo backends.
 *
 * @public
 */
export function getEchoSrv(): EchoSrv {
  return singletonInstance;
}

/**
 * Used to register echo backends that will receive Grafana echo events during application
 * runtime.
 *
 * @public
 */
export const registerEchoBackend = (backend: EchoBackend) => {
  getEchoSrv().addBackend(backend);
};
