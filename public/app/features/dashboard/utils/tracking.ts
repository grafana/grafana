import { reportInteraction } from '@grafana/runtime';

import { DashboardModel } from '../state';

export function trackDashboardLoaded(dashboard: DashboardModel, versionBeforeMigration?: number) {
  // Count the different types of variables
  const variables = dashboard.templating.list
    .map((v) => v.type)
    .reduce((r, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});

  reportInteraction('dashboards_init_dashboard_completed', {
    uid: dashboard.uid,
    title: dashboard.title,
    theme: dashboard.style,
    schemaVersion: dashboard.schemaVersion,
    version_before_migration: versionBeforeMigration,
    panels_count: dashboard.panels.length,
    ...variables,
  });
}

const variableName = (type: string) => `variable_type_${type}_count`;
