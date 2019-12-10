import { Subject } from 'rxjs';
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

interface BusEventHandler<T = BusEvent> {
  (event: T): void;
}

export class EventBus {
  private eventStream: Subject<any>;

  constructor() {
    this.eventStream = new Subject();
  }

  public emit(event: any): void {
    console.log('emit');
    this.eventStream.next(event);
  }

  // public group(): BusEventGroup {
  //   return new BusEventGroup(this);
  // }

  public on<T>(typeFilter: BusEventType<T>, handler: BusEventHandler): Subscription {
    return this.eventStream
      .pipe(
        filter(event => {
          return event instanceof typeFilter;
        })
      )
      .subscribe({ next: handler });
  }

  public subscribe(handler: BusEventHandler): Subscription {
    console.log('sub');
    return this.eventStream.subscribe({ next: handler });
  }
}

// // ----------------------------------------------------------------------------------- //
// // ----------------------------------------------------------------------------------- //
//
// // I am a convenience class that keeps track of subscriptions within the group and can
// // mass-unsubscribe from them as needed. Because of this tracking, the methods on this
// // class return a reference to THIS class, instead of a Subscription, allowing for a
// // more fluent API.
// export class MessageBusGroup {
//   private messageBus: MessageBusService;
//   private subscriptions: Subscription[];
//
//   // I initialize the message bus group service.
//   constructor(messageBus: MessageBusService) {
//     this.messageBus = messageBus;
//     this.subscriptions = [];
//   }
//
//   // ---
//   // PUBLIC METHODS.
//   // ---
//
//   // I push the given event onto the message bus.
//   public emit(event: any): MessageBusGroup {
//     this.messageBus.emit(event);
//
//     return this;
//   }
//
//   // I subscribe to the message bus, but only invoke the callback when the event is
//   // of the given newable type (ie, it's a Class definition, not an instance).
//   public on<T>(
//     typeFilter: NewableType<T>,
//     callback: CallbackFunction<T>,
//     callbackContext: any = null
//   ): MessageBusGroup {
//     this.subscriptions.push(this.messageBus.on(typeFilter, callback, callbackContext));
//
//     return this;
//   }
//
//   // I subscribe to all events on the message bus.
//   public subscribe(callback: CallbackFunction, callbackContext: any = null): MessageBusGroup {
//     this.subscriptions.push(this.messageBus.subscribe(callback, callbackContext));
//
//     return this;
//   }
//
//   // I unsubscribe from all the current subscriptions.
//   public unsubscribe(): MessageBusGroup {
//     for (var subscription of this.subscriptions) {
//       subscription.unsubscribe();
//     }
//
//     this.subscriptions = [];
//
//     return this;
//   }
// }
