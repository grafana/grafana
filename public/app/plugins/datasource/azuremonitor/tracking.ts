import { reportInteraction } from '@grafana/runtime';

/**
 * Loaded the first time a dashboard containing azure queries is loaded (not on every render)
 * Note: The queries used here are the ones pre-migration and pre-filterQuery
 *
 * This allows answering questions about:
 * - the adoption of the three query types (Azure Monitor, Azure Logs Analytics and Azure Resource Graph)
 * - stats about number of azure dashboards loaded, number of users
 * - stats about the grafana and plugins versions used by our users
 *
 * Dashboard: https://ops.grafana.net/d/Ad0pti0N/data-sources-adoption-tracking?orgId=1
 * Changelog:
 * - v9.1.0 : list of queries logged
 * - v9.1.2 : list removed in favour of stats, user_id removed
 */
export const trackAzureMonitorDashboardLoaded = (props: AzureMonitorDashboardLoadedProps) => {
  reportInteraction('grafana_ds_azuremonitor_dashboard_loaded', props);
};

export type AzureMonitorDashboardLoadedProps = {
  grafana_version?: string;
  dashboard_id: string;
  org_id?: number;

  /** number of non hidden queries of type Azure Monitor if any  */
  azure_monitor_queries: number;
  /** number of hidden queries (not executed) of type Azure Monitor if any  */
  azure_monitor_queries_hidden: number;
  /** number of Azure Monitor queries using multiple resources */
  azure_monitor_multiple_resource: number;
  /** number of Azure Monitor queries */
  azure_monitor_query: number;

  /** number of non hidden queries of type Azure Logs Analytics if any  */
  azure_log_analytics_queries: number;
  /** number of hidden queries (not executed) of type Azure Logs Analytics if any  */
  azure_log_analytics_queries_hidden: number;
  /** number of Azure Log Analytics queries using multiple resources */
  azure_log_multiple_resource: number;
  /** number of Azure Log Analytics queries */
  azure_log_query: number;

  /** number of non hidden queries of type Azure Resource Graph if any  */
  azure_resource_graph_queries: number;
  /** number of hidden queries (not executed) of type Azure Resource Graph if any  */
  azure_resource_graph_queries_hidden: number;
  /** number of Azure Resource Graph queries using multiple subscriptions */
  azure_resource_graph_multiple_subscription: number;
  /** number of Azure Resource Graph queries */
  azure_resource_graph_query: number;

  /** number of non hidden queries of type Azure Traces if any  */
  azure_traces_queries: number;
  /** number of hidden queries of type Azure Traces if any  */
  azure_traces_queries_hidden: number;
  /** number of trace queries using multiple resources */
  azure_traces_multiple_resource: number;
  /** number of trace queries using table format */
  azure_traces_table: number;
  /** number of trace queries using trace format */
  azure_traces_trace: number;
  /** number of trace queries specifying operation ID */
  azure_traces_operation_id_specified: number;
  /** number of trace queries specifying event types */
  azure_traces_event_type_specified: number;
  /** number of trace queries using filters */
  azure_traces_filters: number;
  /** number of Azure Traces queries */
  azure_traces_query: number;

  /** variable query tracking */
  azure_subscriptions_query: number;
  azure_resource_groups_query: number;
  azure_namespaces_query: number;
  azure_resource_names_query: number;
  azure_metric_names_query: number;
  azure_workspaces_query: number;
  azure_grafana_template_variable_query: number;
  azure_locations_query: number;
  azure_unknown_query: number;
};
