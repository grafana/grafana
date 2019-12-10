import { Subject, Unsubscribable } from 'rxjs';
import { filter } from 'rxjs/operators';

/*
 * Base event type
 */
export abstract class BusEvent {
  readonly type: string;
}

/*
 * Bas event type with payload
 */
export abstract class BusEventWithPayload<T> extends BusEvent {
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

/*
 * Event callback/handler type
 */
export interface BusEventHandler<T extends BusEvent> {
  (event: T): void;
}

/*
 * Main minimal interface
 */
export interface EventBus {
  /*
   * Emit single vent
   */
  emit<T extends BusEvent>(event: T): void;
  /*
   * Subscribe to single event
   */
  on<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable;
}

export class EventBusSrv implements EventBus {
  private eventStream: Subject<any>;

  constructor() {
    this.eventStream = new Subject();
  }

  public emit<T extends BusEvent>(event: T): void {
    this.eventStream.next(event);
  }

  public on<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.eventStream
      .pipe(
        filter(event => {
          return event instanceof typeFilter;
        })
      )
      .subscribe({ next: handler });
  }
}

/**
 * Handles unsubscribing to all events subscribed through this group
 */
export class EventBusGroup implements EventBus {
  private subscriptions: Unsubscribable[];

  constructor(private bus: EventBus) {
    this.subscriptions = [];
  }

  public emit<T extends BusEvent>(event: T) {
    this.bus.emit(event);
  }

  public on<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    const sub = this.bus.on(typeFilter, handler);
    this.subscriptions.push(sub);
    return sub;
  }

  public unsubscribe() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];
  }
}
