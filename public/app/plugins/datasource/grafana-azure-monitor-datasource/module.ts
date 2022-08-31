import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import Datasource from './datasource';
import pluginJson from './plugin.json';
import { trackAzureMonitorDashboardLoaded } from './tracking';
import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AzureMonitorQueryEditor);

// Track dashboard loads to RudderStack
getAppEvents().subscribe<DashboardLoadedEvent<AzureMonitorQuery>>(
  DashboardLoadedEvent,
  ({ payload: { dashboardId, orgId, userId, grafanaVersion, queries } }) => {
    const azureQueries = queries[pluginJson.id];
    let stats = {
      [AzureQueryType.AzureMonitor]: {
        hidden: 0,
        visible: 0,
      },
      [AzureQueryType.LogAnalytics]: {
        hidden: 0,
        visible: 0,
      },
      [AzureQueryType.AzureResourceGraph]: {
        hidden: 0,
        visible: 0,
      },
    };
    azureQueries.forEach((query) => {
      if (
        query.queryType === AzureQueryType.AzureMonitor ||
        query.queryType === AzureQueryType.LogAnalytics ||
        query.queryType === AzureQueryType.AzureResourceGraph
      ) {
        stats[query.queryType][query.hide ? 'hidden' : 'visible']++;
      }
    });

    if (azureQueries && azureQueries.length > 0) {
      trackAzureMonitorDashboardLoaded({
        grafana_version: grafanaVersion,
        dashboard_id: dashboardId,
        org_id: orgId,
        azure_monitor_queries: stats[AzureQueryType.AzureMonitor].visible,
        azure_log_analytics_queries: stats[AzureQueryType.LogAnalytics].visible,
        azure_resource_graph_queries: stats[AzureQueryType.AzureResourceGraph].visible,
        azure_monitor_queries_hidden: stats[AzureQueryType.AzureMonitor].hidden,
        azure_log_analytics_queries_hidden: stats[AzureQueryType.LogAnalytics].hidden,
        azure_resource_graph_queries_hidden: stats[AzureQueryType.AzureResourceGraph].hidden,
      });
    }
  }
);
