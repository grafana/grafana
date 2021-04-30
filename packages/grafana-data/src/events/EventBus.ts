import EventEmitter from 'eventemitter3';
import { Unsubscribable, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { StreamingDataFrame } from '../dataframe';
import {
  EventBus,
  LegacyEmitter,
  BusEventHandler,
  BusEventType,
  LegacyEventHandler,
  BusEvent,
  AppEvent,
} from './types';

/**
 * @alpha
 */
export class EventBusSrv implements EventBus, LegacyEmitter {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  publish<T extends BusEvent>(event: T): void {
    this.emitter.emit(event.type, event);
  }

  subscribe<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(typeFilter).subscribe({ next: handler });
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return new Observable<T>((observer) => {
      const handler = (event: T) => {
        observer.next(event);
      };

      this.emitter.on(eventType.type, handler);

      return () => {
        this.emitter.off(eventType.type, handler);
      };
    });
  }

  newScopedBus(key: string, localOnly?: boolean): EventBus {
    return new ScopedEventBus([key], this, Boolean(localOnly));
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
  }
}

/**
 * Wraps EventBus and adds a source to help with identifying if a subscriber should react to the event or not.
 */
class ScopedEventBus implements EventBus {
  // The path is not yet exposed, but can be used to indicate nested groups and support faster filtering
  constructor(public path: string[], private eventBus: EventBus, private localOnly: boolean) {}

  publish<T extends BusEvent>(event: T): void {
    if (!event.origin) {
      (event as any).origin = this;
    }
    this.eventBus.publish(event);
  }

  updateScope(localOnly: boolean) {
    this.localOnly = localOnly;
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    const stream = this.eventBus.getStream(eventType);

    if (this.localOnly) {
      return stream.pipe(filter((streamEvent) => streamEvent.origin === this));
    }

    return stream;
  }

  removeAllListeners(): void {
    this.eventBus.removeAllListeners();
  }

  /**
   * Creates a nested event bus structure
   */
  newScopedBus(key: string, localOnly?: boolean): EventBus {
    return new ScopedEventBus([...this.path, key], this, Boolean(localOnly));
  }
}
