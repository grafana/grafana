import type { TimeRange } from '@grafana/data';
import type * as React from 'react';

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
   */
  timeRange?: TimeRange;
  /**
   * Map of variable name to value. Updating this prop pushes the values into the
   * matching variables of the embedded dashboard (matched by name).
   */
  variables?: Record<string, string | string[]>;
  /**
   * Hides the embedded dashboard's time picker and refresh controls. Useful when the
   * consumer renders its own time controls and drives the range via `timeRange`.
   */
  hideTimeControls?: boolean;
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
