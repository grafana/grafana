import { type RulerNotificationSettingsDTO } from './api/types';

// Where an alert rule's notifications go, as `NotificationsSettingsSelector` emits it. A local copy of the
// `NotificationSettings` type from grafana/grafana#134990; import that one instead once it's merged.
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

export type NotificationSettings = SimplifiedRoutingSettings | NamedRoutingTreeSettings;

/**
 * Turns a `NotificationsSettingsSelector` value into the Ruler shape the convert API's
 * `X-Grafana-Alerting-Notification-Settings` header takes. `null` (default routing) gives `undefined`,
 * meaning "leave the header out".
 */
export function toRulerNotificationSettings(
  value: NotificationSettings | null
): RulerNotificationSettingsDTO | undefined {
  if (!value) {
    return undefined;
  }

  if (value.type === 'NamedRoutingTree') {
    return { policy: value.routingTree };
  }

  return withoutEmpty({
    receiver: value.receiver,
    group_by: value.groupBy,
    group_wait: value.groupWait,
    group_interval: value.groupInterval,
    repeat_interval: value.repeatInterval,
    mute_time_intervals: value.muteTimeIntervals,
    active_time_intervals: value.activeTimeIntervals,
  });
}

/**
 * Reads Ruler-shaped notification settings, e.g. a rule's `notification_settings` from Grafana's ruler API,
 * back into a `NotificationsSettingsSelector` value. Settings with neither a policy nor a receiver mean
 * default routing, which is `null`.
 */
export function fromRulerNotificationSettings(
  settings: RulerNotificationSettingsDTO | null | undefined
): NotificationSettings | null {
  if (settings?.policy) {
    return { type: 'NamedRoutingTree', routingTree: settings.policy };
  }

  if (!settings?.receiver) {
    return null;
  }

  return withoutEmpty<SimplifiedRoutingSettings>({
    type: 'SimplifiedRouting',
    receiver: settings.receiver,
    groupBy: settings.group_by,
    groupWait: settings.group_wait,
    groupInterval: settings.group_interval,
    repeatInterval: settings.repeat_interval,
    muteTimeIntervals: settings.mute_time_intervals,
    activeTimeIntervals: settings.active_time_intervals,
  });
}

// A copy without unset, blank or empty-list fields. The API rejects an empty duration, and an empty list
// means the same as leaving it out.
function withoutEmpty<T extends object>(value: T): T {
  const copy = { ...value };
  for (const key in copy) {
    const field: unknown = copy[key];
    if (field === undefined || field === '' || (Array.isArray(field) && field.length === 0)) {
      delete copy[key];
    }
  }
  return copy;
}
