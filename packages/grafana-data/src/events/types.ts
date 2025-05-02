import { Unsubscribable, Observable } from 'rxjs';

/**
 * @alpha
 * internal interface
 */
export interface BusEvent {
  readonly type: string;
  readonly payload?: any;
  origin?: EventBus;
}

/**
 * @alpha
 * Base event type
 */
export abstract class BusEventBase implements BusEvent {
  readonly type: string;
  readonly payload?: any;
  readonly origin?: EventBus;

  /** @internal */
  tags?: Set<string>;

  constructor() {
    //@ts-ignore
    this.type = this.__proto__.constructor.type;
  }

  /**
   * @internal
   * Tag event for finer-grained filtering in subscribers
   */
  setTags(tags: string[]) {
    this.tags = new Set(tags);
    return this;
  }
}

/**
 * @alpha
 * Base event type with payload
 */
export abstract class BusEventWithPayload<T> extends BusEventBase {
  readonly payload: T;

  constructor(payload: T) {
    super();
    this.payload = payload;
  }
}

/*
 * Interface for an event type constructor
 */
export interface BusEventType<T extends BusEvent> {
  type: string;
  new (...args: any[]): T;
}

/**
 * @alpha
 * Event callback/handler type
 */
export interface BusEventHandler<T extends BusEvent> {
  (event: T): void;
}

/**
 * @alpha
 * Main minimal interface
 */
export interface EventFilterOptions {
  onlyLocal: boolean;
}

/**
 * @alpha
 * Main minimal interface
 */
export interface EventBus {
  /**
   * Publish single event
   */
  publish<T extends BusEvent>(event: T): void;

  /**
   * Get observable of events
   */
  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T>;

  /**
   * Subscribe to an event stream
   *
   * This function is a wrapper around the `getStream(...)` function
   */
  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable;

  /**
   * Remove all event subscriptions
   */
  removeAllListeners(): void;

  /**
   * Returns a new bus scoped that knows where it exists in a heiarchy
   *
   * @internal -- This is included for internal use only should not be used directly
   */
  newScopedBus(key: string, filter: EventFilterOptions): EventBus;
}

/**
 * @public
 * @deprecated event type
 */
export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

/** @public */
export interface LegacyEmitter {
  /**
   * @deprecated use $emit
   */
  emit<T>(event: AppEvent<T> | string, payload?: T): void;

  /**
   * @deprecated use $on
   */
  on<T>(event: AppEvent<T> | string, handler: LegacyEventHandler<T>): void;

  /**
   * @deprecated use $on
   */
  off<T>(event: AppEvent<T> | string, handler: (payload?: T) => void): void;
}

/** @public */
export interface LegacyEventHandler<T> {
  (payload: T): void;
  wrapper?: (event: BusEvent) => void;
}

/** @alpha */
export interface EventBusExtended extends EventBus, LegacyEmitter {}
