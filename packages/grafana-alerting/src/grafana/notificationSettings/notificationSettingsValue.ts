import { type AlertRuleNotificationSettings } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

interface SimplifiedRoutingSettings {
  type: 'SimplifiedRouting';
  receiver: string;
  groupBy?: string[];
  groupWait?: string;
  groupInterval?: string;
  repeatInterval?: string;
  muteTimeIntervals?: string[];
  activeTimeIntervals?: string[];
}

interface NamedRoutingTreeSettings {
  type: 'NamedRoutingTree';
  routingTree: string;
}

/** Where an alert rule's notifications go. The selector uses `null` for default routing. */
export type NotificationSettings = SimplifiedRoutingSettings | NamedRoutingTreeSettings;

// A copy without the keys set to undefined, so equality checks and serialization see only what is set.
function withoutUndefined<T extends object>(value: T): T {
  const copy = { ...value };
  for (const key in copy) {
    if (copy[key] === undefined) {
      delete copy[key];
    }
  }
  return copy;
}

export function simplifiedRouting(
  receiver: string,
  options: Omit<SimplifiedRoutingSettings, 'type' | 'receiver'> = {}
): SimplifiedRoutingSettings {
  const { groupBy, groupWait, groupInterval, repeatInterval, muteTimeIntervals, activeTimeIntervals } = options;
  const value: SimplifiedRoutingSettings = {
    type: 'SimplifiedRouting',
    receiver,
    groupBy,
    // A cleared duration field is '', which the API rejects; leave it unset instead.
    groupWait: groupWait || undefined,
    groupInterval: groupInterval || undefined,
    repeatInterval: repeatInterval || undefined,
    muteTimeIntervals,
    activeTimeIntervals,
  };
  return withoutUndefined(value);
}

export function namedRoutingTree(routingTree: string): NamedRoutingTreeSettings {
  return { type: 'NamedRoutingTree', routingTree };
}

export function toRuleNotificationSettings(
  value: NotificationSettings | null
): AlertRuleNotificationSettings | undefined {
  if (!value) {
    return undefined;
  }

  if (value.type === 'NamedRoutingTree') {
    return { type: 'NamedRoutingTree', routingTree: value.routingTree };
  }

  const { type, receiver, groupBy, groupWait, groupInterval, repeatInterval, muteTimeIntervals, activeTimeIntervals } =
    value;
  const copy: SimplifiedRoutingSettings = {
    type,
    receiver,
    groupBy,
    groupWait,
    groupInterval,
    repeatInterval,
    muteTimeIntervals,
    activeTimeIntervals,
  };
  return withoutUndefined(copy);
}

export function fromRuleNotificationSettings(
  rule: AlertRuleNotificationSettings | null | undefined
): NotificationSettings | null {
  if (!rule) {
    return null;
  }

  // The rule's `type` isn't a true discriminant (both variants share one type), so narrow on the fields.
  if ('receiver' in rule) {
    const {
      type,
      receiver,
      groupBy,
      groupWait,
      groupInterval,
      repeatInterval,
      muteTimeIntervals,
      activeTimeIntervals,
      ...unmapped
    } = rule;
    // Fails to compile when the rules API adds a field this value doesn't carry yet.
    unmapped satisfies Record<string, never>;
    const value: SimplifiedRoutingSettings = {
      type: 'SimplifiedRouting',
      receiver,
      groupBy,
      groupWait,
      groupInterval,
      repeatInterval,
      muteTimeIntervals,
      activeTimeIntervals,
    };
    return withoutUndefined(value);
  }

  const { type, routingTree, ...unmapped } = rule;
  unmapped satisfies Record<string, never>;
  return { type: 'NamedRoutingTree', routingTree };
}
