import { Subject, Unsubscribable } from 'rxjs';
import { filter } from 'rxjs/operators';

export abstract class BusEvent {
  readonly type: string;
}

export abstract class BusEventWithPayload<T> extends BusEvent {
  readonly payload: T;

  constructor(payload: T) {
    super();
    this.payload = payload;
  }
}

export interface BusEventType<T extends BusEvent> {
  type: string;
  new (...args: any[]): T;
}

export interface BusEventHandler<T extends BusEvent> {
  (event: T): void;
}

export class EventBus {
  private eventStream: Subject<any>;

  constructor() {
    this.eventStream = new Subject();
  }

  public emit<T extends BusEvent>(event: T): void {
    this.eventStream.next(event);
  }

  public newGroup(): EventBusGroup {
    return new EventBusGroup(this);
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

  public subscribe(handler: BusEventHandler<T>): Unsubscribable {
    return this.eventStream.subscribe({ next: handler });
  }
}

export class EventBusGroup {
  private bus: EventBus;
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
