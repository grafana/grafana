import EventEmitter from 'eventemitter3';
import { Unsubscribable, Observable } from 'rxjs';
import { PayloadWithSource } from './common';
import {
  EventBus,
  LegacyEmitter,
  BusEventHandler,
  BusEventType,
  LegacyEventHandler,
  BusEvent,
  AppEvent,
  BusEventWithPayload,
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
 * @alpha
 *
 * Wraps EventBus and adds a source to help with identifying if a subscriber should react to the event or not.
 */
export class EventBusWithSource implements EventBus {
  source: string;
  eventBus: EventBus;

  constructor(eventBus: EventBus, source: string) {
    this.eventBus = eventBus;
    this.source = source;
  }

  publish<T extends BusEvent>(event: T): void {
    const decoratedEvent = {
      ...event,
      ...{ payload: { ...event.payload, ...{ source: this.source } } },
    };
    this.eventBus.publish(decoratedEvent);
  }

  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.eventBus.subscribe(eventType, handler);
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return this.eventBus.getStream(eventType);
  }

  removeAllListeners(): void {
    this.eventBus.removeAllListeners();
  }

  isOwnEvent(event: BusEventWithPayload<PayloadWithSource>): boolean {
    return event.payload.source === this.source;
  }
}
