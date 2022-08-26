import { reportInteraction } from '@grafana/runtime';

/**
 * Loaded the first time a dashboard containing azure queries is loaded (not on every render)
 *
 * This allows answering questions about:
 * - the adoption of the three query types (Azure Monitor, Azure Logs Analytics and Azure Resource Graph)
 * - stats about number of azure dashboards loaded, number of users
 * - stats about the grafana and plugins versions used by our users
 *
 * Dashboard: https://ops.grafana.net/d/Ad0pti0N/data-sources-adoption-tracking?orgId=1
 * Changelog:
 * - v9.1.0 : list of queries logged
 * - v9.1.2 : list removed in favour of stats, ds_version added, user_id removed
 */
export const TrackAzureMonitorDashboardLoaded = (props: AzureMonitorDashboardLoadedProps) => {
  reportInteraction('grafana_ds_azuremonitor_dashboard_loaded', props);
};

type AzureMonitorDashboardLoadedProps = {
  grafana_version?: string;
  dashboard_id: string;
  org_id?: number;
  /** version of Azure Monitor the user is running */
  ds_version: string;
  /** number of executed queries (non hidden) of type Azure Monitor if any  */
  azure_monitor_queries_executed?: number;
  /** number of executed queries (non hidden) of type Azure Logs Analytics if any  */
  azure_log_analytics_queries_executed?: number;
  /** number of executed queries (non hidden) of type Azure Resource Graph if any  */
  azure_resource_graph_queries_exectued?: number;
  /** number of hidden queries (not executed) of type Azure Monitor if any  */
  azure_monitor_queries_hidden?: number;
  /** number of hidden queries (not executed) of type Azure Logs Analytics if any  */
  azure_log_analytics_queries_hidden?: number;
  /** number of hidden queries (not executed) of type Azure Resource Graph if any  */
  azure_resource_graph_queries_hidden?: number;
};
