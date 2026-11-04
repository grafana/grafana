// Mirrors Alertmanager's defaults, which unset timings fall back to when the default policy doesn't set them.
export const TIMING_DEFAULTS = { groupWait: '30s', groupInterval: '5m', repeatInterval: '4h' };

// The group-by value that sends each alert as a separate notification.
export const DISABLE_GROUPING = '...';

/** Plain Prometheus durations (e.g. `30s`); unset fields use the defaults. */
export interface RoutingTimings {
  groupWait?: string;
  groupInterval?: string;
  repeatInterval?: string;
}
