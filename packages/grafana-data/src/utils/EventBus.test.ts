import { EventBus, BusEventWithPayload } from './EventBus';

interface CustomEventPayload {
  count: number;
}

class CustomEvent extends BusEventWithPayload<CustomEventPayload> {
  public static type = 'custom-event';
  public type = CustomEvent.type;
}

describe('EventBus', () => {
  it('Can subscribe to all events', done => {
    const bus = new EventBus();
    const gotEvent: CustomEvent | null = null;

    bus.subscribe(CustomEvent, (event: CustomEvent) => {
      console.log('aaa');
      getEvent = event;
    });

    bus.emit(new CustomEvent({ count: 10 }));

    setTimeout(() => {
      if (gotEvent) {
        expect(gotEvent.count).toBe(10);
      } else {
        throw new Error('Got no event');
      }
      done();
    });
  });
});
