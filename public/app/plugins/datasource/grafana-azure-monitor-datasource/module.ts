import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import Datasource from './datasource';
import pluginJson from './plugin.json';
import { TrackAzureMonitorDashboardLoaded } from './tracking';
import { AzureMonitorQuery, AzureDataSourceJsonData } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AzureMonitorQueryEditor);

// Track dashboard loads to RudderStack
getAppEvents().subscribe<DashboardLoadedEvent<AzureMonitorQuery>>(
  DashboardLoadedEvent,
  ({ payload: { dashboardId, orgId, userId, grafanaVersion, queries } }) => {
    const azureQueries = queries[pluginJson.id];
    let stats: { [key: string]: number } = {};
    azureQueries.forEach((query) => {
      const statName =
        (query.queryType ?? '').toLowerCase().replace(/ /gi, '_') + '_queries_' + (query.hide ? 'hidden' : 'executed');
      stats[statName] = ~~stats[statName] + 1;
    });

    if (azureQueries && azureQueries.length > 0) {
      TrackAzureMonitorDashboardLoaded({
        grafana_version: grafanaVersion,
        ds_version: pluginJson.info.version,
        dashboard_id: dashboardId,
        org_id: orgId,
        ...stats,
      });
    }
  }
);
