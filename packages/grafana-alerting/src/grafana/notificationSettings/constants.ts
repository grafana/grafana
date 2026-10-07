import { type AlertRuleSimplifiedRouting } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

// What Alertmanager falls back to when a timing isn't overridden; shown as placeholders and summaries.
export const TIMING_DEFAULTS = { groupWait: '30s', groupInterval: '5m', repeatInterval: '4h' };

// Always part of an overridden group-by, mirroring the internal RouteSettings.tsx.
export const REQUIRED_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];

export type RoutingTimings = Pick<AlertRuleSimplifiedRouting, 'groupWait' | 'groupInterval' | 'repeatInterval'>;
