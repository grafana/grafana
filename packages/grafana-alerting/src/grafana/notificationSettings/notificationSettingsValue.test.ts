import { type AlertRuleNotificationSettings } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import {
  type NotificationSettings,
  contactPointRouting,
  fromRuleNotificationSettings,
  policyRouting,
  toRuleNotificationSettings,
} from './notificationSettingsValue';

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

const namedTree = { type: 'NamedRoutingTree', routingTree: 'deployment-tools' } satisfies NotificationSettings;

describe('contactPointRouting', () => {
  it('builds a value from just a receiver', () => {
    expect(contactPointRouting('slack-oncall')).toEqual({ type: 'SimplifiedRouting', receiver: 'slack-oncall' });
  });

  it('leaves out the fields that are not set', () => {
    expect(contactPointRouting('slack-oncall', { groupInterval: '5m', repeatInterval: '' })).toStrictEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupInterval: '5m',
    });
  });

  it('carries the optional timings and intervals along', () => {
    expect(contactPointRouting('slack-oncall', { groupWait: '1m', muteTimeIntervals: ['weekends'] })).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '1m',
      muteTimeIntervals: ['weekends'],
    });
  });

  it('drops blank timings so they are not sent as empty durations', () => {
    const value = contactPointRouting('slack-oncall', { groupWait: '', groupInterval: '5m', repeatInterval: '' });

    expect(JSON.parse(JSON.stringify(value))).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupInterval: '5m',
    });
  });
});

describe('contactPointRouting with zero timings', () => {
  it('keeps a zero duration, which is valid, and only drops blank ones', () => {
    const value = contactPointRouting('slack-oncall', { groupWait: '0', groupInterval: '0s', repeatInterval: '' });

    expect(JSON.parse(JSON.stringify(value))).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '0',
      groupInterval: '0s',
    });
  });
});

describe('contactPointRouting with an existing value as options', () => {
  it('keeps the new receiver while carrying the existing timings along', () => {
    expect(contactPointRouting('new-contact-point', fullSimplified)).toEqual({
      ...fullSimplified,
      receiver: 'new-contact-point',
    });
  });
});

describe('contactPointRouting with unrelated properties in the options', () => {
  it('does not carry them onto the value', () => {
    const previousNamedTree = { groupWait: '1m', routingTree: 'deployment-tools' };

    expect(contactPointRouting('slack-oncall', previousNamedTree)).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '1m',
    });
  });
});

describe('policyRouting', () => {
  it('builds a value from a tree name', () => {
    expect(policyRouting('deployment-tools')).toEqual(namedTree);
  });
});

describe('toRuleNotificationSettings', () => {
  it('maps simplified routing with every field to the rules API shape', () => {
    expect(toRuleNotificationSettings(fullSimplified)).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupBy: ['alertname', 'cluster'],
      groupWait: '30s',
      groupInterval: '5m',
      repeatInterval: '4h',
      muteTimeIntervals: ['weekends'],
      activeTimeIntervals: ['business-hours'],
    });
  });

  it('maps a named routing tree to the rules API shape', () => {
    expect(toRuleNotificationSettings(namedTree)).toEqual({
      type: 'NamedRoutingTree',
      routingTree: 'deployment-tools',
    });
  });

  it('leaves out unset fields and copies instead of sharing the value', () => {
    const value = contactPointRouting('slack-oncall');

    const rule = toRuleNotificationSettings(value);

    expect(rule).toStrictEqual({ type: 'SimplifiedRouting', receiver: 'slack-oncall' });
    expect(rule).not.toBe(value);
  });

  it('does not pass properties the value does not define on to the API', () => {
    const withStrayProperty = { ...namedTree, unrelated: 'form state' };

    expect(toRuleNotificationSettings(withStrayProperty)).toStrictEqual({
      type: 'NamedRoutingTree',
      routingTree: 'deployment-tools',
    });
  });

  it('keeps a zero duration from a value built without the helper', () => {
    const value: NotificationSettings = {
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '0',
      groupInterval: '0s',
    };

    expect(toRuleNotificationSettings(value)).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '0',
      groupInterval: '0s',
    });
  });

  it('drops blank timings from a value built without the helper', () => {
    const value: NotificationSettings = {
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '',
      groupInterval: '',
      repeatInterval: '5m',
    };

    expect(toRuleNotificationSettings(value)).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      repeatInterval: '5m',
    });
  });

  it('maps no value (default routing) to no settings', () => {
    expect(toRuleNotificationSettings(null)).toBeUndefined();
  });
});

describe('fromRuleNotificationSettings', () => {
  it('maps simplified routing from the rules API shape', () => {
    const rule: AlertRuleNotificationSettings = { ...fullSimplified };

    expect(fromRuleNotificationSettings(rule)).toEqual(fullSimplified);
  });

  it('maps a named routing tree from the rules API shape', () => {
    expect(fromRuleNotificationSettings({ type: 'NamedRoutingTree', routingTree: 'deployment-tools' })).toEqual(
      namedTree
    );
  });

  it('leaves out the fields the rule does not set', () => {
    expect(fromRuleNotificationSettings({ type: 'SimplifiedRouting', receiver: 'slack-oncall' })).toStrictEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
    });
  });

  it.each([null, undefined])('maps %p (no settings) to default routing', (rule) => {
    expect(fromRuleNotificationSettings(rule)).toBeNull();
  });

  it.each([fullSimplified, namedTree, contactPointRouting('slack-oncall')])(
    'round-trips %j through the rules API shape',
    (value) => {
      expect(fromRuleNotificationSettings(toRuleNotificationSettings(value))).toEqual(value);
    }
  );
});
