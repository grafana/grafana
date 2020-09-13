import { EventBusSrv, BusEventWithPayload, EventBusGroup } from './EventBus';
import { alertSuccess } from '../types/appEvents';

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

describe('EventBus', () => {
  it('Can create events', () => {
    expect(new LoginEvent({ logins: 1 }).type).toBe('login-event');
  });

  it('Can subscribe specific event', () => {
    const bus = new EventBusSrv();
    const events: LoginEvent[] = [];

    bus.$on(LoginEvent, event => {
      events.push(event);
    });

    bus.$emit(new LoginEvent({ logins: 10 }));
    bus.$emit(new HelloEvent({ hellos: 10 }));

    expect(events[0].payload.logins).toBe(10);
    expect(events.length).toBe(1);
  });

  it('EventBusGroup handles unsub', () => {
    const bus = new EventBusSrv();
    const group = new EventBusGroup(bus);
    const events: LoginEvent[] = [];

    group.$on(LoginEvent, event => {
      events.push(event);
    });

    bus.$emit(new LoginEvent({ logins: 10 }));

    expect(events.length).toBe(1);

    group.unsubscribe();

    bus.$emit(new LoginEvent({ logins: 10 }));
    expect(events.length).toBe(1);
  });

  it('EventBusGroup allows manual unsub', () => {
    const bus = new EventBusSrv();
    const group = new EventBusGroup(bus);
    const events: LoginEvent[] = [];

    group
      .$on(LoginEvent, event => {
        events.push(event);
      })
      .unsubscribe();

    bus.$emit(new LoginEvent({ logins: 10 }));
    expect(events.length).toBe(0);
  });

  it('Supports legacy events', () => {
    const bus = new EventBusSrv();
    const events: any = [];

    bus.on(alertSuccess, event => {
      events.push(event);
    });

    bus.emit(alertSuccess, ['hello', 'hello2']);

    expect(events[0]).toEqual(['hello', 'hello2']);
  });
});
