import EventEmitter from 'eventemitter3';
import { Unsubscribable, Observable, Subscriber } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  EventBus,
  LegacyEmitter,
  BusEventHandler,
  BusEventType,
  LegacyEventHandler,
  BusEvent,
  AppEvent,
  EventFilterOptions,
  EventBusWithFiltering,
  EventFilter,
} from './types';

/**
 * @alpha
 */
export class EventBusSrv implements EventBus, LegacyEmitter {
  private emitter: EventEmitter;
  private subscribers = new Map<Function, Subscriber<BusEvent>>();

  constructor() {
    this.emitter = new EventEmitter();
  }

  publish<T extends BusEvent>(event: T): void {
    this.emitter.emit(event.type, event);
  }

  subscribe<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(typeFilter).subscribe({ next: handler });
  }

  getStream<T extends BusEvent = BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return new Observable<T>((observer) => {
      const handler = (event: T) => {
        observer.next(event);
      };

      this.emitter.on(eventType.type, handler);
      this.subscribers.set(handler, observer);

      return () => {
        this.emitter.off(eventType.type, handler);
        this.subscribers.delete(handler);
      };
    });
  }

  /**
   * Legacy functions
   */
  emit<T>(event: AppEvent<T> | string, payload?: T | any): void {
    // console.log(`Deprecated emitter function used (emit), use $emit`);

    if (typeof event === 'string') {
      this.emitter.emit(event, { type: event, payload });
    } else {
      this.emitter.emit(event.name, { type: event.name, payload });
    }
  }

  on<T>(event: AppEvent<T> | string, handler: LegacyEventHandler<T>, scope?: any) {
    // console.log(`Deprecated emitter function used (on), use $on`);

    // need this wrapper to make old events compatible with old handlers
    handler.wrapper = (emittedEvent: BusEvent) => {
      handler(emittedEvent.payload);
    };

    if (typeof event === 'string') {
      this.emitter.on(event, handler.wrapper);
    } else {
      this.emitter.on(event.name, handler.wrapper);
    }

    if (scope) {
      const unbind = scope.$on('$destroy', () => {
        this.off(event, handler);
        unbind();
      });
    }
  }

  off<T>(event: AppEvent<T> | string, handler: LegacyEventHandler<T>) {
    if (typeof event === 'string') {
      this.emitter.off(event, handler.wrapper);
      return;
    }

    this.emitter.off(event.name, handler.wrapper);
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
    for (const [key, sub] of this.subscribers) {
      sub.complete();
      this.subscribers.delete(key);
    }
  }
}

/**
 * Proxy to EventBus that adds a source to help with identifying if a subscriber should react to the event or not.
 */
export class ScopedEventBus implements EventBusWithFiltering {
  constructor(
    private eventBus: EventBus,
    private _filterConfig: EventFilterOptions = { filter: EventFilter.NoLocal }
  ) {}

  publish<T extends BusEvent>(event: T): void {
    if (!event.origin) {
      // @ts-ignore
      event.origin = this;
    }
    this.eventBus.publish(event);
  }

  filter = (event: BusEvent) => {
    if (this._filterConfig.filter === EventFilter.All) {
      return true;
    }
    if (this._filterConfig.filter === EventFilter.OnlyLocal) {
      return (event as any).origin === this;
    }

    if (this._filterConfig.filter === EventFilter.NoLocal) {
      return (event as any).origin !== this;
    }
    return true;
  };

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return this.eventBus.getStream(eventType).pipe(filter(this.filter)) as Observable<T>;
  }

  // syntax sugar
  subscribe<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(typeFilter).subscribe({ next: handler });
  }

  removeAllListeners(): void {
    this.eventBus.removeAllListeners();
  }

  setFilterConfig(config: Partial<EventFilterOptions>): void {
    this._filterConfig = { ...this._filterConfig, ...config };
  }

  // getter for filterConfig
  get filterConfig(): EventFilterOptions {
    return this._filterConfig;
  }
}
