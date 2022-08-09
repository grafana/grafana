import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction, getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import Datasource from './datasource';
import { id } from './plugin.json';
import { AzureMonitorQuery, AzureDataSourceJsonData } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AzureMonitorQueryEditor);

// Track dashboard loads to RudderStack
getAppEvents().subscribe<DashboardLoadedEvent<AzureMonitorQuery>>(
  DashboardLoadedEvent,
  ({ payload: { dashboardId, orgId, userId, grafanaVersion, queries } }) => {
    reportInteraction('grafana_ds_azuremonitor_dashboard_loaded', {
      grafana_version: grafanaVersion,
      dashboard_id: dashboardId,
      org_id: orgId,
      user_id: userId,
      queries: queries[id].map((query: AzureMonitorQuery) => ({
        hidden: !!query.hide,
        query_type: query.queryType,
      })),
    });
  }
);
