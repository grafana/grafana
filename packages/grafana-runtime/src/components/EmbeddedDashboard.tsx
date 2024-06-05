import * as React from 'react';

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
