import { EventBusSrv, ScopedEventBus } from './EventBus';
import { eventFactory } from './eventFactory';
import { BusEventWithPayload, EventFilter } from './types';

interface LoginEventPayload {
  logins: number;
}

interface HelloEventPayload {
  hellos: number;
}

class LoginEvent extends BusEventWithPayload<LoginEventPayload> {
  static type = 'login-event';
}

class HelloEvent extends BusEventWithPayload<HelloEventPayload> {
  static type = 'hello-event';
}

type LegacyEventPayload = [string, string];

export const legacyEvent = eventFactory<LegacyEventPayload>('legacy-event');

class AlertSuccessEvent extends BusEventWithPayload<LegacyEventPayload> {
  static type = 'legacy-event';
}

describe('EventBus', () => {
  it('Can create events', () => {
    expect(new LoginEvent({ logins: 1 }).type).toBe('login-event');
  });

  it('Can subscribe specific event', () => {
    const bus = new EventBusSrv();
    const events: LoginEvent[] = [];

    bus.subscribe(LoginEvent, (event) => {
      events.push(event);
    });

    bus.publish(new LoginEvent({ logins: 10 }));
    bus.publish(new HelloEvent({ hellos: 10 }));

    expect(events[0].payload.logins).toBe(10);
    expect(events.length).toBe(1);
  });

  describe('Legacy emitter behavior', () => {
    it('Supports legacy events', () => {
      const bus = new EventBusSrv();
      const events: LegacyEventPayload[] = [];
      const handler = (event: LegacyEventPayload) => {
        events.push(event);
      };

      bus.on(legacyEvent, handler);
      bus.emit(legacyEvent, ['hello', 'hello2']);

      bus.off(legacyEvent, handler);
      bus.emit(legacyEvent, ['hello', 'hello2']);

      expect(events.length).toEqual(1);
      expect(events[0]).toEqual(['hello', 'hello2']);
    });

    it('Interoperability with legacy events', () => {
      const bus = new EventBusSrv();
      const legacyEvents: LegacyEventPayload[] = [];
      const newEvents: AlertSuccessEvent[] = [];

      bus.on(legacyEvent, (event) => {
        legacyEvents.push(event);
      });

      bus.subscribe(AlertSuccessEvent, (event) => {
        newEvents.push(event);
      });

      bus.emit(legacyEvent, ['legacy', 'params']);
      bus.publish(new AlertSuccessEvent(['new', 'event']));

      expect(legacyEvents).toEqual([
        ['legacy', 'params'],
        ['new', 'event'],
      ]);

      expect(newEvents).toEqual([
        {
          type: 'legacy-event',
          payload: ['legacy', 'params'],
        },
        {
          type: 'legacy-event',
          payload: ['new', 'event'],
        },
      ]);
    });

    it('should notfiy subscribers', () => {
      const bus = new EventBusSrv();
      let sub1Called = false;
      let sub2Called = false;

      bus.on(legacyEvent, () => {
        sub1Called = true;
      });
      bus.on(legacyEvent, () => {
        sub2Called = true;
      });

      bus.emit(legacyEvent, null);

      expect(sub1Called).toBe(true);
      expect(sub2Called).toBe(true);
    });

    it('when subscribing twice', () => {
      const bus = new EventBusSrv();
      let sub1Called = 0;

      function handler() {
        sub1Called += 1;
      }

      bus.on(legacyEvent, handler);
      bus.on(legacyEvent, handler);

      bus.emit(legacyEvent, null);

      expect(sub1Called).toBe(2);
    });

    it('should handle errors', () => {
      const bus = new EventBusSrv();
      let sub1Called = 0;
      let sub2Called = 0;

      bus.on(legacyEvent, () => {
        sub1Called++;
        throw { message: 'hello' };
      });

      bus.on(legacyEvent, () => {
        sub2Called++;
      });

      try {
        bus.emit(legacyEvent, null);
      } catch (_) {}
      try {
        bus.emit(legacyEvent, null);
      } catch (_) {}

      expect(sub1Called).toBe(2);
      expect(sub2Called).toBe(0);
    });

    it('removeAllListeners should unsubscribe to all', () => {
      const bus = new EventBusSrv();
      const events: LoginEvent[] = [];
      let completed = false;

      bus.getStream(LoginEvent).subscribe({
        next: (evt) => events.push(evt),
        complete: () => (completed = true),
      });

      bus.removeAllListeners();
      bus.publish(new LoginEvent({ logins: 10 }));

      expect(events.length).toBe(0);
      expect(completed).toBe(true);
    });
  });
});

describe('ScopedEventBus', () => {
  it('Proxies events to origin bus', () => {
    const sourceBus = new EventBusSrv();
    const events: LoginEvent[] = [];

    sourceBus.subscribe(LoginEvent, (event) => {
      events.push(event);
    });

    const scoped = new ScopedEventBus(sourceBus);
    scoped.publish(new LoginEvent({ logins: 10 }));
    scoped.publish(new LoginEvent({ logins: 11 }));
    expect(events[0].payload.logins).toBe(10);
    expect(events.length).toBe(2);
  });

  it('Filters out local events', () => {
    const sourceBus = new EventBusSrv();

    const events: LoginEvent[] = [];
    const filteredEvents1: LoginEvent[] = [];
    const filteredEvents2: LoginEvent[] = [];

    sourceBus.subscribe(LoginEvent, (event) => {
      events.push(event);
    });

    const scoped1 = new ScopedEventBus(sourceBus, { filter: EventFilter.NoLocal });
    const scoped2 = new ScopedEventBus(sourceBus, { filter: EventFilter.NoLocal });

    scoped1.subscribe(LoginEvent, (event) => {
      filteredEvents1.push(event);
    });

    scoped2.subscribe(LoginEvent, (event) => {
      filteredEvents2.push(event);
    });

    scoped1.publish(new LoginEvent({ logins: 10 }));
    scoped1.publish(new LoginEvent({ logins: 11 }));

    // reacted to all events
    expect(events.length).toBe(2);
    // ignored local events
    expect(filteredEvents1.length).toBe(0);
    // reacted to all events
    expect(filteredEvents2.length).toBe(2);
  });

  it('Listens to local events only by default', () => {
    const sourceBus = new EventBusSrv();

    const events: LoginEvent[] = [];
    const filteredEvents1: LoginEvent[] = [];
    const filteredEvents2: LoginEvent[] = [];

    sourceBus.subscribe(LoginEvent, (event) => {
      events.push(event);
    });

    const scoped1 = new ScopedEventBus(sourceBus);
    const scoped2 = new ScopedEventBus(sourceBus);

    scoped1.subscribe(LoginEvent, (event) => {
      filteredEvents1.push(event);
    });

    scoped2.subscribe(LoginEvent, (event) => {
      filteredEvents2.push(event);
    });

    scoped1.publish(new LoginEvent({ logins: 10 }));
    scoped1.publish(new LoginEvent({ logins: 11 }));
    scoped2.publish(new LoginEvent({ logins: 11 }));
    sourceBus.publish(new LoginEvent({ logins: 11 }));

    // reacted to all events
    expect(events.length).toBe(4);
    // reacted to scoped1 bus events only
    expect(filteredEvents1.length).toBe(2);
    // reacted to sourceBus and scoped1 bus events
    expect(filteredEvents2.length).toBe(1);
  });

  it('Allows listening to all events ', () => {
    const sourceBus = new EventBusSrv();

    const events: LoginEvent[] = [];
    const filteredEvents1: LoginEvent[] = [];
    const filteredEvents2: LoginEvent[] = [];

    sourceBus.subscribe(LoginEvent, (event) => {
      events.push(event);
    });

    const scoped1 = new ScopedEventBus(sourceBus, { filter: EventFilter.All });
    const scoped2 = new ScopedEventBus(sourceBus, { filter: EventFilter.All });

    scoped1.subscribe(LoginEvent, (event) => {
      filteredEvents1.push(event);
    });

    scoped2.subscribe(LoginEvent, (event) => {
      filteredEvents2.push(event);
    });

    scoped1.publish(new LoginEvent({ logins: 10 }));
    scoped1.publish(new LoginEvent({ logins: 11 }));
    scoped2.publish(new LoginEvent({ logins: 11 }));
    sourceBus.publish(new LoginEvent({ logins: 11 }));

    // reacted to all events
    expect(events.length).toBe(4);
    // reacted to all events
    expect(filteredEvents1.length).toBe(4);
    // reacted to all events
    expect(filteredEvents2.length).toBe(4);
  });
});
