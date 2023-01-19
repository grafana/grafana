import { EventBusSrv } from './EventBus';
import { DataHoverEvent } from './common';
import { eventFactory } from './eventFactory';
import { BusEvent, BusEventWithPayload } from './types';

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

  describe('EventBusWithSource', () => {
    it('can add sources to the source path', () => {
      const bus = new EventBusSrv();
      const busWithSource = bus.newScopedBus('foo');
      expect((busWithSource as any).path).toEqual(['foo']);
    });

    it('adds the source to the event payload', () => {
      const bus = new EventBusSrv();
      let events: BusEvent[] = [];

      bus.subscribe(DataHoverEvent, (event) => events.push(event));

      const busWithSource = bus.newScopedBus('foo');
      busWithSource.publish({ type: DataHoverEvent.type });

      expect(events.length).toEqual(1);
      expect(events[0].origin).toEqual(busWithSource);
    });
  });

  describe('Legacy emitter behavior', () => {
    it('Supports legacy events', () => {
      const bus = new EventBusSrv();
      const events: any = [];
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
      const legacyEvents: any = [];
      const newEvents: any = [];

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
