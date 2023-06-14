import { reportInteraction } from '@grafana/runtime';

import { DashboardModel } from '../state';

export function trackDashboardLoaded(dashboard: DashboardModel) {
  // Count the different types of variables
  const variables = dashboard.templating.list
    .map((v) => v.type)
    .reduce((r, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});

  reportInteraction('dashboard_loaded', {
    uid: dashboard.uid,
    title: dashboard.title,
    style: dashboard.style,
    schemaVersion: dashboard.schemaVersion,
    panels_count: dashboard.panels.length,
    ...variables,
  });
}

const variableName = (type: string) => `variable_type_${type}_count`;
