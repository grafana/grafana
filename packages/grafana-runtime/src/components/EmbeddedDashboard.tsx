import React from 'react';

import { Dashboard } from '@grafana/schema';

export interface EmbeddedDashboardProps {
  uid?: string;
  dashboard?: Dashboard;
  /** Set to true to show in drawer */
  inDrawer?: boolean;
  /** Only relevant when inDrawer = true */
  onClose?: () => void;
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
