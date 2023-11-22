import EventEmitter from 'eventemitter3';
import { Unsubscribable, Observable, Subscriber, merge, Subscription } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';

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

  // Should be changed so the filter contains publish/subscribe filters.
  // It should also return a EventBus and not the ScopedEventBus.
  newScopedBus(key: string, filter?: EventFilterOptions): ScopedEventBus {
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
  constructor(
    public path: string[],
    private eventBus: EventBus,
    filter?: EventFilterOptions
  ) {
    this.filterConfig = filter ?? { onlyLocal: false };
  }

  publish<T extends BusEvent>(event: T): void {
    if (!event.origin) {
      event.origin = this;
    }
    this.eventBus.publish(event);
  }

  filter<T extends BusEvent>(event: T) {
    if (this.filterConfig.onlyLocal) {
      return event.origin === this;
    }
    return true;
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return this.eventBus.getStream(eventType).pipe(filter(this.filter.bind(this)));
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

type PublishEventFilter = (scope: string[], event: BusEvent) => 'parent' | 'local' | 'none';
type SubscribeEventFilter = (scope: string[], event: BusEvent) => boolean;
type ScopedEvent = BusEvent & {
  path: Readonly<string[]>;
};

class ScopedEventBus2 implements EventBus {
  private parent: EventBus;
  private local: EventBus;
  private subscriptions = new Set<Subscriber<BusEvent>>();

  constructor(
    private path: string[],
    parent: EventBus,
    private publishFilter?: PublishEventFilter,
    private subscribeFilter?: SubscribeEventFilter
  ) {
    this.parent = parent;
    this.local = new EventBusSrv();
  }

  publish<T extends BusEvent>(event: T): void {
    if (isScopedEvent(event)) {
      return this.publishToChannel(event);
    }

    return this.publishToChannel({
      path: this.path,
      ...event,
    });
  }

  private publishToChannel(event: ScopedEvent): void {
    const channel = this.publishFilter?.(this.path, event);

    switch (channel) {
      case 'parent':
        return this.parent.publish(event);
      case 'none':
        return;
      default:
        return this.local.publish(event);
    }
  }

  private filterSubscription<T extends BusEvent>(event: T): boolean {
    if (this.subscribeFilter) {
      return this.subscribeFilter(this.path, event);
    }
    return true;
  }

  getStream<T extends BusEvent>(eventType: BusEventType<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.subscriptions.add(subscriber);

      return merge(this.parent.getStream(eventType), this.local.getStream(eventType))
        .pipe(
          filter(this.filterSubscription),
          finalize(() => {
            if (this.subscriptions.has(subscriber)) {
              this.subscriptions.delete(subscriber);
            }
          })
        )
        .subscribe(subscriber);
    });
  }

  subscribe<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.getStream(eventType).subscribe({ next: handler });
  }

  removeAllListeners(): void {
    this.local.removeAllListeners();
    // We should only complete the subscriptions this eventBus has made
    // to the parent. We can't call removeAllListeners since that will
    // remove listeners from other scoped event buses.
    for (const sub of this.subscriptions) {
      sub.complete();
      this.subscriptions.delete(sub);
    }
  }

  newScopedBus(key: string, filter: EventFilterOptions): EventBus {
    const subscribeFilter = filter.onlyLocal ? subscribeEventFilters.onlyLocal : undefined;
    return new ScopedEventBus2([...this.path, key], this, undefined, subscribeFilter);
  }
}

const subscribeEventFilters: Record<string, SubscribeEventFilter> = {
  noFilter: () => true,
  onlyGlobal: (_, event) => !isScopedEvent(event),
  onlyLocal: (path, event) => isScopedEvent(event) && isPathEqual(path, event.path),
};

function isPathEqual(pathA: string[], pathB: readonly string[]): boolean {
  if (pathA.length !== pathB.length) {
    return false;
  }

  for (let index = 0; index < pathA.length; index++) {
    const a = pathA[index];
    const b = pathB[index];

    if (a !== b) {
      return false;
    }
  }

  return true;
}

function isScopedEvent(event: BusEvent): event is ScopedEvent {
  return 'path' in event;
}
