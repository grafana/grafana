import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardModel } from '../state';

export function trackDashboardLoaded(dashboard: DashboardModel, versionBeforeMigration?: number) {
  // Count the different types of variables
  const variables = dashboard.templating.list
    .map((v) => v.type)
    .reduce((r, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});

  // Track number and type of deprecated panels still in use
  const deprecatedGraphPanelCount = dashboard.panels.filter((panel) => panel.type === 'graph').length;
  const deprecatedTablePanelCount = dashboard.panels.filter((panel) => panel.type === 'table-old').length;
  const deprecatedStatPanelCount = dashboard.panels.filter((panel) => panel.type === 'grafana-singlestat-panel').length;
  const deprecatedPieChartPanelCount = dashboard.panels.filter(
    (panel) => panel.type === 'grafana-piechart-panel'
  ).length;
  const deprecatedWorldmapPanelCount = dashboard.panels.filter(
    (panel) => panel.type === 'grafana-worldmap-panel'
  ).length;

  DashboardInteractions.dashboardInitialized({
    uid: dashboard.uid,
    title: dashboard.title,
    theme: dashboard.style,
    schemaVersion: dashboard.schemaVersion,
    version_before_migration: versionBeforeMigration,
    panels_count: dashboard.panels.length,
    deprecated_graph_panel_count: deprecatedGraphPanelCount,
    deprecated_table_panel_count: deprecatedTablePanelCount,
    deprecated_stat_panel_count: deprecatedStatPanelCount,
    deprecated_piechart_panel_count: deprecatedPieChartPanelCount,
    deprecated_worldmap_panel_count: deprecatedWorldmapPanelCount,
    ...variables,
  });
}

const variableName = (type: string) => `variable_type_${type}_count`;
