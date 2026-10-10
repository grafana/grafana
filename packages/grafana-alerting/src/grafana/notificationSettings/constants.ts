// Mirrors Alertmanager's defaults; shown as placeholders and in the collapsed summary.
export const TIMING_DEFAULTS = { groupWait: '30s', groupInterval: '5m', repeatInterval: '4h' };

// Always part of an overridden group-by, mirroring the internal RouteSettings.tsx.
export const REQUIRED_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];

/** Plain Prometheus durations (e.g. `30s`); unset fields use the defaults. */
export interface RoutingTimings {
  groupWait?: string;
  groupInterval?: string;
  repeatInterval?: string;
}
