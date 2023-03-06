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

  newScopedBus(key: string, filter?: EventFilterOptions): EventBus {
    return new ScopedEventBus([key], this, filter);
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
 * Wraps EventBus and adds a source to help with identifying if a subscriber should react to the event or not.
 */
class ScopedEventBus implements EventBus {
  // will be mutated by panel runners
  filterConfig: EventFilterOptions;

  // The path is not yet exposed, but can be used to indicate nested groups and support faster filtering
  constructor(public path: string[], private eventBus: EventBus, filter?: EventFilterOptions) {
    this.filterConfig = filter ?? { onlyLocal: false };
  }

  publish<T extends BusEvent>(event: T): void {
    if (!event.origin) {
      (event as any).origin = this;
    }
    this.eventBus.publish(event);
  }

  filter = (event: BusEvent) => {
    if (this.filterConfig.onlyLocal) {
      return event.origin === this;
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

  /**
   * Creates a nested event bus structure
   */
  newScopedBus(key: string, filter: EventFilterOptions): EventBus {
    return new ScopedEventBus([...this.path, key], this, filter);
  }
}
