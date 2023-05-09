import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import Datasource from './datasource';
import pluginJson from './plugin.json';
import { trackAzureMonitorDashboardLoaded } from './tracking';
import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType, ResultFormat } from './types';

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
        multiResource: 0,
      },
      [AzureQueryType.LogAnalytics]: {
        hidden: 0,
        visible: 0,
        multiResource: 0,
      },
      [AzureQueryType.AzureResourceGraph]: {
        hidden: 0,
        visible: 0,
        multiSubscription: 0,
      },
      [AzureQueryType.AzureTraces]: {
        hidden: 0,
        visible: 0,
        multiResource: 0,
        table: 0,
        trace: 0,
        operationIdSpecified: 0,
        eventTypesSpecified: 0,
        filtersSpecified: 0,
      },
    };
    azureQueries.forEach((query) => {
      if (query.queryType === AzureQueryType.AzureMonitor) {
        stats[AzureQueryType.AzureMonitor][query.hide ? 'hidden' : 'visible']++;
        if (query.azureMonitor?.resources && query.azureMonitor.resources.length > 1) {
          stats[AzureQueryType.AzureMonitor].multiResource++;
        }
      }
      if (query.queryType === AzureQueryType.LogAnalytics) {
        stats[AzureQueryType.LogAnalytics][query.hide ? 'hidden' : 'visible']++;
        if (query.azureLogAnalytics?.resources && query.azureLogAnalytics.resources.length > 1) {
          stats[AzureQueryType.LogAnalytics].multiResource++;
        }
      }
      if (query.queryType === AzureQueryType.AzureResourceGraph) {
        stats[AzureQueryType.AzureResourceGraph][query.hide ? 'hidden' : 'visible']++;
        if (query.subscriptions && query.subscriptions.length > 1) {
          stats[AzureQueryType.AzureResourceGraph].multiSubscription++;
        }
      }
      if (query.queryType === AzureQueryType.AzureTraces) {
        stats[AzureQueryType.AzureTraces][query.hide ? 'hidden' : 'visible']++;
        if (query.azureTraces) {
          if (query.azureTraces.resultFormat) {
            stats[AzureQueryType.AzureTraces][
              query.azureTraces.resultFormat === ResultFormat.Trace ? ResultFormat.Trace : ResultFormat.Table
            ]++;
          }
          if (query.azureTraces.resources && query.azureTraces.resources.length > 1) {
            stats[AzureQueryType.AzureTraces].multiResource++;
          }
          if (query.azureTraces.operationId && query.azureTraces.operationId !== '') {
            stats[AzureQueryType.AzureTraces].operationIdSpecified++;
          }
          if (query.azureTraces.traceTypes && query.azureTraces.traceTypes.length > 0) {
            stats[AzureQueryType.AzureTraces].eventTypesSpecified++;
          }
          if (query.azureTraces.filters && query.azureTraces.filters.length > 0) {
            stats[AzureQueryType.AzureTraces].filtersSpecified++;
          }
        }
      }
    });

    if (azureQueries && azureQueries.length > 0) {
      trackAzureMonitorDashboardLoaded({
        grafana_version: grafanaVersion,
        dashboard_id: dashboardId,
        org_id: orgId,
        // Metrics queries stats
        azure_monitor_queries: stats[AzureQueryType.AzureMonitor].visible,
        azure_monitor_queries_hidden: stats[AzureQueryType.AzureMonitor].hidden,
        azure_monitor_multiple_resource: stats[AzureQueryType.AzureMonitor].multiResource,

        // Logs queries stats
        azure_log_analytics_queries: stats[AzureQueryType.LogAnalytics].visible,
        azure_log_analytics_queries_hidden: stats[AzureQueryType.LogAnalytics].hidden,
        azure_log_multiple_resource: stats[AzureQueryType.LogAnalytics].multiResource,

        // ARG queries stats
        azure_resource_graph_queries: stats[AzureQueryType.AzureResourceGraph].visible,
        azure_resource_graph_queries_hidden: stats[AzureQueryType.AzureResourceGraph].hidden,
        azure_resource_graph_multiple_subscription: stats[AzureQueryType.AzureResourceGraph].multiSubscription,

        // Traces queries stats
        azure_traces_queries: stats[AzureQueryType.AzureTraces].visible,
        azure_traces_queries_hidden: stats[AzureQueryType.AzureTraces].hidden,
        azure_traces_multiple_resource: stats[AzureQueryType.AzureTraces].multiResource,
        azure_traces_table: stats[AzureQueryType.AzureTraces].table,
        azure_traces_trace: stats[AzureQueryType.AzureTraces].trace,
        azure_traces_operation_id_specified: stats[AzureQueryType.AzureTraces].operationIdSpecified,
        azure_traces_event_type_specified: stats[AzureQueryType.AzureTraces].eventTypesSpecified,
        azure_traces_filters: stats[AzureQueryType.AzureTraces].filtersSpecified,
      });
    }
  }
);
