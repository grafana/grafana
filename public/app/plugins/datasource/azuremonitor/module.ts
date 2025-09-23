import { DataSourcePlugin, DashboardLoadedEvent } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
import Datasource from './datasource';
import pluginJson from './plugin.json';
import { trackAzureMonitorDashboardLoaded } from './tracking';
import { AzureMonitorQuery, AzureMonitorDataSourceJsonData, AzureQueryType, ResultFormat } from './types';

export const plugin = new DataSourcePlugin<Datasource, AzureMonitorQuery, AzureMonitorDataSourceJsonData>(Datasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AzureMonitorQueryEditor);

interface Statistics {
  hidden: number;
  visible: number;
  multiResource: number;
  count: number;
  [key: string]: number;
}

// Track dashboard loads to RudderStack
getAppEvents().subscribe<DashboardLoadedEvent<AzureMonitorQuery>>(
  DashboardLoadedEvent,
  ({ payload: { dashboardId, orgId, userId, grafanaVersion, queries } }) => {
    const azureQueries = queries[pluginJson.id];
    const common = {
      hidden: 0,
      visible: 0,
      multiResource: 0,
      count: 0,
    };
    let stats: { [key in AzureQueryType | string]: Statistics } = {
      [AzureQueryType.AzureMonitor]: {
        ...common,
      },
      [AzureQueryType.LogAnalytics]: {
        ...common,
        grafanaTime: 0,
        queryTime: 0,
      },
      [AzureQueryType.AzureResourceGraph]: {
        ...common,
      },
      [AzureQueryType.AzureTraces]: {
        ...common,
        table: 0,
        trace: 0,
        operationIdSpecified: 0,
        eventTypesSpecified: 0,
        filtersSpecified: 0,
      },
      [AzureQueryType.SubscriptionsQuery]: { ...common },
      [AzureQueryType.ResourceGroupsQuery]: { ...common },
      [AzureQueryType.NamespacesQuery]: { ...common },
      [AzureQueryType.ResourceNamesQuery]: { ...common },
      [AzureQueryType.MetricNamesQuery]: { ...common },
      [AzureQueryType.WorkspacesQuery]: { ...common },
      [AzureQueryType.GrafanaTemplateVariableFn]: { ...common },
      [AzureQueryType.LocationsQuery]: { ...common },
      unknown: { ...common },
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
        stats[AzureQueryType.LogAnalytics][query.azureLogAnalytics?.dashboardTime ? 'grafanaTime' : 'queryTime']++;
        if (query.azureLogAnalytics?.resources && query.azureLogAnalytics.resources.length > 1) {
          stats[AzureQueryType.LogAnalytics].multiResource++;
        }
      }
      if (query.queryType === AzureQueryType.AzureResourceGraph) {
        stats[AzureQueryType.AzureResourceGraph][query.hide ? 'hidden' : 'visible']++;
        if (query.subscriptions && query.subscriptions.length > 1) {
          stats[AzureQueryType.AzureResourceGraph].multiResource++;
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

      switch (query.queryType) {
        case AzureQueryType.AzureMonitor:
        case AzureQueryType.LogAnalytics:
        case AzureQueryType.AzureResourceGraph:
        case AzureQueryType.AzureTraces:
        case AzureQueryType.SubscriptionsQuery:
        case AzureQueryType.ResourceGroupsQuery:
        case AzureQueryType.NamespacesQuery:
        case AzureQueryType.ResourceNamesQuery:
        case AzureQueryType.MetricNamesQuery:
        case AzureQueryType.WorkspacesQuery:
        case AzureQueryType.GrafanaTemplateVariableFn:
        case AzureQueryType.LocationsQuery:
          stats[query.queryType].count++;
          break;
        default:
          stats.unknown.count++;
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
        azure_monitor_query: stats[AzureQueryType.AzureMonitor].count,

        // Logs queries stats
        azure_log_analytics_queries: stats[AzureQueryType.LogAnalytics].visible,
        azure_log_analytics_queries_hidden: stats[AzureQueryType.LogAnalytics].hidden,
        azure_log_multiple_resource: stats[AzureQueryType.LogAnalytics].multiResource,
        azure_log_analytics_queries_grafana_time: stats[AzureQueryType.LogAnalytics].grafanaTime,
        azure_log_analytics_queries_query_time: stats[AzureQueryType.LogAnalytics].queryTime,
        azure_log_query: stats[AzureQueryType.LogAnalytics].count,

        // ARG queries stats
        azure_resource_graph_queries: stats[AzureQueryType.AzureResourceGraph].visible,
        azure_resource_graph_queries_hidden: stats[AzureQueryType.AzureResourceGraph].hidden,
        azure_resource_graph_multiple_subscription: stats[AzureQueryType.AzureResourceGraph].multiResource,
        azure_resource_graph_query: stats[AzureQueryType.AzureResourceGraph].count,

        // Traces queries stats
        azure_traces_queries: stats[AzureQueryType.AzureTraces].visible,
        azure_traces_queries_hidden: stats[AzureQueryType.AzureTraces].hidden,
        azure_traces_multiple_resource: stats[AzureQueryType.AzureTraces].multiResource,
        azure_traces_table: stats[AzureQueryType.AzureTraces].table,
        azure_traces_trace: stats[AzureQueryType.AzureTraces].trace,
        azure_traces_operation_id_specified: stats[AzureQueryType.AzureTraces].operationIdSpecified,
        azure_traces_event_type_specified: stats[AzureQueryType.AzureTraces].eventTypesSpecified,
        azure_traces_filters: stats[AzureQueryType.AzureTraces].filtersSpecified,
        azure_traces_query: stats[AzureQueryType.AzureTraces].count,

        // Variable queries stats
        azure_subscriptions_query: stats[AzureQueryType.SubscriptionsQuery].count,
        azure_resource_groups_query: stats[AzureQueryType.ResourceGroupsQuery].count,
        azure_namespaces_query: stats[AzureQueryType.NamespacesQuery].count,
        azure_resource_names_query: stats[AzureQueryType.ResourceNamesQuery].count,
        azure_metric_names_query: stats[AzureQueryType.MetricNamesQuery].count,
        azure_workspaces_query: stats[AzureQueryType.WorkspacesQuery].count,
        azure_grafana_template_variable_query: stats[AzureQueryType.GrafanaTemplateVariableFn].count,
        azure_locations_query: stats[AzureQueryType.LocationsQuery].count,

        // Unknown query type
        azure_unknown_query: stats.unknown.count,
      });
    }
  }
);
