import { type RulerNotificationSettingsDTO } from './api/types';
import {
  type NotificationSettings,
  fromRulerNotificationSettings,
  toRulerNotificationSettings,
} from './notificationSettings';

const fullSimplified = {
  type: 'SimplifiedRouting',
  receiver: 'slack-oncall',
  groupBy: ['alertname', 'cluster'],
  groupWait: '30s',
  groupInterval: '5m',
  repeatInterval: '4h',
  muteTimeIntervals: ['weekends'],
  activeTimeIntervals: ['business-hours'],
} satisfies NotificationSettings;

const fullRuler = {
  receiver: 'slack-oncall',
  group_by: ['alertname', 'cluster'],
  group_wait: '30s',
  group_interval: '5m',
  repeat_interval: '4h',
  mute_time_intervals: ['weekends'],
  active_time_intervals: ['business-hours'],
};

describe('toRulerNotificationSettings', () => {
  it('maps default routing to undefined, so the header is left out', () => {
    expect(toRulerNotificationSettings(null)).toBeUndefined();
  });

  it('maps a named routing tree to a policy', () => {
    expect(toRulerNotificationSettings({ type: 'NamedRoutingTree', routingTree: 'team-a' })).toStrictEqual({
      policy: 'team-a',
    });
  });

  it('maps a contact point and its overrides to snake case', () => {
    expect(toRulerNotificationSettings(fullSimplified)).toStrictEqual(fullRuler);
  });

  it('leaves out blank durations and empty lists', () => {
    expect(
      toRulerNotificationSettings({
        type: 'SimplifiedRouting',
        receiver: 'slack-oncall',
        groupBy: [],
        groupWait: '',
        repeatInterval: '4h',
      })
    ).toStrictEqual({ receiver: 'slack-oncall', repeat_interval: '4h' });
  });
});

describe('fromRulerNotificationSettings', () => {
  it.each([undefined, null])('reads %p as default routing', (settings) => {
    expect(fromRulerNotificationSettings(settings)).toBeNull();
  });

  // Not valid settings, but a rule read back from the API could still have them.
  it.each([{}, { receiver: '' }])('reads malformed settings %p as default routing', (settings) => {
    expect(fromRulerNotificationSettings(settings as RulerNotificationSettingsDTO)).toBeNull();
  });

  it('reads a policy as a named routing tree, even next to an empty receiver', () => {
    expect(fromRulerNotificationSettings({ receiver: '', policy: 'team-a' })).toStrictEqual({
      type: 'NamedRoutingTree',
      routingTree: 'team-a',
    });
  });

  it('lets the policy win when settings have both a receiver and a policy', () => {
    // @ts-expect-error The type allows a contact point or a policy, never both.
    const both: RulerNotificationSettingsDTO = { receiver: 'oncall', policy: 'team-a' };

    expect(fromRulerNotificationSettings(both)).toStrictEqual({ type: 'NamedRoutingTree', routingTree: 'team-a' });
  });

  it('reads a receiver and its overrides as a contact point', () => {
    expect(fromRulerNotificationSettings(fullRuler)).toStrictEqual(fullSimplified);
  });

  it('round-trips through the Ruler shape', () => {
    expect(fromRulerNotificationSettings(toRulerNotificationSettings(fullSimplified))).toStrictEqual(fullSimplified);
  });
});
