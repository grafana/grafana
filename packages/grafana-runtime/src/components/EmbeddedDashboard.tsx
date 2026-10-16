import type * as React from 'react';

import type { TimeRange } from '@grafana/data';

export interface EmbeddedDashboardProps {
  uid?: string;
  /**
   * Use this property to override initial time and variable state.
   * Example: ?from=now-5m&to=now&var-varname=value1
   */
  initialState?: string;
  /**
   * Is called when ever the internal embedded dashboards url state changes.
   * Can be used to sync the internal url state (Which is not synced to URL) with the external context, or to
   * preserve some of the state when moving to other embedded dashboards.
   */
  onStateChange?: (state: string) => void;
  /**
   * When set, drives the embedded dashboard's time range. Updating this prop syncs the
   * new range into the embedded dashboard without remounting it.
   * Takes precedence over any `from`/`to` provided through `initialState`.
   * Static state such as variable values or hiding the time picker can instead be passed
   * via `initialState` (e.g. `var-name=value`, `_dash.hideTimePicker=true`).
   */
  timeRange?: TimeRange;
  /**
   * Change this value (for example by incrementing a counter) to trigger a data refresh.
   * Re-runs all queries and re-evaluates relative time ranges, mirroring the dashboard's
   * own refresh button.
   */
  refreshToken?: string | number;
}

/**
 * Returns a React component that renders an embedded dashboard.
 * @alpha
 */
export let EmbeddedDashboard: React.ComponentType<EmbeddedDashboardProps> = () => {
  throw new Error('EmbeddedDashboard requires runtime initialization');
};

/**
 *
 * @internal
 */
export function setEmbeddedDashboard(component: React.ComponentType<EmbeddedDashboardProps>) {
  EmbeddedDashboard = component;
}
