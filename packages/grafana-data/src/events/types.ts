import { Unsubscribable, Observable } from 'rxjs';

/**
 * @alpha
 * internal interface
 */
export interface BusEvent {
  readonly type: string;
  readonly payload?: any;
}

/**
 * @alpha
 * Base event type
 */
export abstract class BusEventBase implements BusEvent {
  readonly type: string;
  readonly payload?: any;

  constructor() {
    //@ts-ignore
    this.type = this.__proto__.constructor.type;
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
export interface EventBus {
  /**
   * Publish single vent
   */
  publish<T extends BusEvent>(event: T): void;

  /**
   * Subscribe to single event
   */
  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable;

  /**
   * Get observable of events
   */
  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T>;

  /**
   * Remove all event subscriptions
   */
  removeAllListeners(): void;
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
  on<T>(event: AppEvent<T> | string, handler: LegacyEventHandler<T>, scope?: any): void;

  /**
   * @deprecated use $on
   */
  off<T>(event: AppEvent<T> | string, handler: (payload?: T | any) => void): void;
}

/** @public */
export interface LegacyEventHandler<T> {
  (payload: T): void;
  wrapper?: (event: BusEvent) => void;
}

/** @alpha */
export interface EventBusExtended extends EventBus, LegacyEmitter {}
