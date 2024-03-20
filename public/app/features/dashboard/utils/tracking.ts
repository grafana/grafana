import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardModel } from '../state';

export function trackDashboardLoaded(dashboard: DashboardModel, duration: number, versionBeforeMigration?: number) {
  // Count the different types of variables
  const variables = dashboard.templating.list
    .map((v) => v.type)
    .reduce((r: Record<string, number>, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});

  // Count the different types of panels
  const panels = dashboard.panels
    .map((p) => p.type)
    .reduce((r: Record<string, number>, p) => {
      r[panelName(p)] = 1 + r[panelName(p)] || 1;
      return r;
    }, {});

  DashboardInteractions.dashboardInitialized({
    uid: dashboard.uid,
    title: dashboard.title,
    theme: dashboard.style,
    schemaVersion: dashboard.schemaVersion,
    version_before_migration: versionBeforeMigration,
    panels_count: dashboard.panels.length,
    ...panels,
    ...variables,
    settings_nowdelay: dashboard.timepicker.nowDelay,
    settings_livenow: !!dashboard.liveNow,
    duration,
  });
}

const variableName = (type: string) => `variable_type_${type}_count`;
const panelName = (type: string) => `panel_type_${type}_count`;
