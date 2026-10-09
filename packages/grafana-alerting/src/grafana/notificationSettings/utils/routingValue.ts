import {
  type AlertRuleNamedRoutingTree,
  type AlertRuleNotificationSettings,
  type AlertRuleSimplifiedRouting,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

// `type` isn't a true discriminant here (both branches share AlertRuleNotificationSettingsType) — narrow
// on `receiver`/`routingTree` instead. Exported so consumers don't reimplement this.
export function asSimplifiedRouting(value: AlertRuleNotificationSettings | null): AlertRuleSimplifiedRouting | null {
  if (value !== null && 'receiver' in value) {
    return value;
  }
  return null;
}

export function asNamedRoutingTree(value: AlertRuleNotificationSettings | null): AlertRuleNamedRoutingTree | null {
  if (value !== null && 'routingTree' in value) {
    return value;
  }
  return null;
}

export function toSimplifiedRouting(
  receiver: string,
  options: Omit<AlertRuleSimplifiedRouting, 'type' | 'receiver'> = {}
): AlertRuleSimplifiedRouting {
  // A cleared duration field is '', which the API rejects; leave it unset instead.
  const { groupWait, groupInterval, repeatInterval } = options;
  return {
    type: 'SimplifiedRouting',
    receiver,
    ...options,
    groupWait: groupWait || undefined,
    groupInterval: groupInterval || undefined,
    repeatInterval: repeatInterval || undefined,
  };
}

export function toNamedRoutingTree(routingTree: string): AlertRuleNamedRoutingTree {
  return { type: 'NamedRoutingTree', routingTree };
}
