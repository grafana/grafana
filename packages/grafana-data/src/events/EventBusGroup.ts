// import { Unsubscribable, Subscription, Observable } from 'rxjs';
// import { BusEvent, BusEventType, BusEventHandler, EventBus } from './types';

// /**
//  * Handles unsubscribing to all events subscribed through this group
//  */
// export class EventBusGroup implements EventBus {
//   private groupSub?: Subscription;

//   constructor(private bus: EventBus) {}

//   $emit<T extends BusEvent>(event: T) {
//     this.bus.$emit(event);
//   }

//   $on<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
//     return this.addToGroupSub(this.bus.$on(typeFilter, handler));
//   }

//   private addToGroupSub(childSub: Unsubscribable): Unsubscribable {
//     if (!this.groupSub) {
//       this.groupSub = new Subscription();
//     }

//     return this.groupSub.add(childSub);
//   }

//   unsubscribe() {
//     if (this.groupSub) {
//       this.groupSub.unsubscribe();
//     }
//   }
// }
//
// it('EventBusGroup handles unsub', () => {
//     const bus = new EventBusSrv();
//     const group = new EventBusGroup(bus);
//     const events: LoginEvent[] = [];

//     group.$on(LoginEvent, event => {
//       events.push(event);
//     });

//     bus.$emit(new LoginEvent({ logins: 10 }));

//     expect(events.length).toBe(1);

//     group.unsubscribe();

//     bus.$emit(new LoginEvent({ logins: 10 }));
//     expect(events.length).toBe(1);
//   });

//   it('EventBusGroup allows manual unsub', () => {
//     const bus = new EventBusSrv();
//     const group = new EventBusGroup(bus);
//     const events: LoginEvent[] = [];

//     group
//       .$on(LoginEvent, event => {
//         events.push(event);
//       })
//       .unsubscribe();

//     bus.$emit(new LoginEvent({ logins: 10 }));
//     expect(events.length).toBe(0);
//   });
