/**
 * Describes a size with width/height
 *
 * @public
 */
export interface SizeMeta {
  width: number;
  height: number;
}

/**
 * Describes the meta information that are sent together with each event.
 *
 * @public
 */
export interface EchoMeta {
  screenSize: SizeMeta;
  windowSize: SizeMeta;
  userAgent: string;
  url?: string;
  path?: string;
  /**
   * A unique browser session
   */
  sessionId: string;
  /**
   * The current user's username used to login into Grafana e.g. email.
   */
  userLogin: string;
  /**
   * The current user's unique identifier.
   */
  userId: number;
  /**
   * True when user is logged in into Grafana.
   */
  userSignedIn: boolean;
  /**
   * Current user's role
   */
  orgRole: string | '';
  /**
   * Current user's org
   */
  orgId: number;
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
 * Describes echo backends that can be registered to receive of events.
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
 * Describes an echo event.
 *
 * @public
 */
export interface EchoEvent<T extends EchoEventType = any, P = any> {
  type: EchoEventType;
  /**
   * Event payload containing event specific data.
   */
  payload: P;
  meta: EchoMeta;
}

/**
 * Supported echo event types that can be sent via the {@link EchoSrv}.
 *
 * @public
 */
export enum EchoEventType {
  Performance = 'performance',
  MetaAnalytics = 'meta-analytics',
  Pageview = 'pageview',
  Interaction = 'interaction',
  ExperimentView = 'experimentview',
  GrafanaJavascriptAgent = 'grafana-javascript-agent',
}

/**
 * Used to send events to all the registered backends. This should be accessed via the
 * {@link getEchoSrv} function. Will, by default, flush events to the backends every
 * 10s or when the flush function is triggered.
 *
 * @public
 */
export interface EchoSrv {
  /**
   * Call this to flush current events to the echo backends.
   */
  flush(): void;
  /**
   * Add a new echo backend to the list of backends that will receive events.
   */
  addBackend(backend: EchoBackend): void;
  /**
   * Call this to add event that will be sent to the echo backends upon next
   * flush.
   *
   * @param event - Object containing event information.
   * @param meta - Object that will extend/override the default meta object.
   */
  addEvent<T extends EchoEvent>(event: Omit<T, 'meta'>, meta?: {}): void;
  /**
   * Subscribe to interaction events by name. The callback fires synchronously
   * every time a matching interaction is reported via {@link reportInteraction}.
   *
   * Returns an unsubscribe function.
   */
  onInteraction(name: string, callback: (properties: Record<string, unknown>) => void): () => void;
}

let singletonInstance: EchoSrv;

/**
 * Used during startup by Grafana to set the EchoSrv so it is available
 * via the {@link getEchoSrv} to the rest of the application.
 *
 * @internal
 */
export function setEchoSrv(instance: EchoSrv) {
  // Check if there were any events reported to the FakeEchoSrv (before the main EchoSrv was initialized), and track them
  if (singletonInstance instanceof FakeEchoSrv) {
    for (const item of singletonInstance.buffer) {
      instance.addEvent(item.event, item.meta);
    }
  }

  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link EchoSrv} that can be used to report events to registered
 * echo backends.
 *
 * @public
 */
export function getEchoSrv(): EchoSrv {
  if (!singletonInstance) {
    singletonInstance = new FakeEchoSrv();
  }

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

export class FakeEchoSrv implements EchoSrv {
  buffer: Array<{ event: Omit<EchoEvent, 'meta'>; meta?: {} | undefined }> = [];
  private interactionSubscribers = new Map<string, Set<(properties: Record<string, unknown>) => void>>();

  flush(): void {
    this.buffer = [];
  }

  addBackend(backend: EchoBackend): void {}

  addEvent<T extends EchoEvent>(event: Omit<T, 'meta'>, meta?: {} | undefined): void {
    this.buffer.push({ event, meta });

    // Dispatch to interaction subscribers
    if (event.type === EchoEventType.Interaction) {
      const payload = event.payload as { interactionName?: string; properties?: Record<string, unknown> };
      if (payload.interactionName) {
        const subscribers = this.interactionSubscribers.get(payload.interactionName);
        if (subscribers) {
          for (const cb of subscribers) {
            cb(payload.properties ?? {});
          }
        }
      }
    }
  }

  onInteraction(name: string, callback: (properties: Record<string, unknown>) => void): () => void {
    let subscribers = this.interactionSubscribers.get(name);
    if (!subscribers) {
      subscribers = new Set();
      this.interactionSubscribers.set(name, subscribers);
    }
    subscribers.add(callback);

    return () => {
      subscribers!.delete(callback);
      if (subscribers!.size === 0) {
        this.interactionSubscribers.delete(name);
      }
    };
  }
}
