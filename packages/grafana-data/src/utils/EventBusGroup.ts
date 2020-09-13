/**
 * Handles unsubscribing to all events subscribed through this group
 */
export class EventBusGroup implements EventBus {
  private groupSub?: Subscription;

  constructor(private bus: EventBus) {}

  $emit<T extends BusEvent>(event: T) {
    this.bus.$emit(event);
  }

  $on<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this.addToGroupSub(this.bus.$on(typeFilter, handler));
  }

  private addToGroupSub(childSub: Unsubscribable): Unsubscribable {
    if (!this.groupSub) {
      this.groupSub = new Subscription();
    }

    return this.groupSub.add(childSub);
  }

  unsubscribe() {
    if (this.groupSub) {
      this.groupSub.unsubscribe();
    }
  }
}
