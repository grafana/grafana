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
 * Dashboard: Ad0pti0N
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
  /** number of non hidden queries of type Azure Logs Analytics if any  */
  azure_log_analytics_queries: number;
  /** number of non hidden queries of type Azure Resource Graph if any  */
  azure_resource_graph_queries: number;
  /** number of hidden queries (not executed) of type Azure Monitor if any  */
  azure_monitor_queries_hidden: number;
  /** number of hidden queries (not executed) of type Azure Logs Analytics if any  */
  azure_log_analytics_queries_hidden: number;
  /** number of hidden queries (not executed) of type Azure Resource Graph if any  */
  azure_resource_graph_queries_hidden: number;
};

/**
 * Used to track data source creation via either the specific plugin page `/plugins/grafana-azure-monitor-datasource`
 * or the general datasources page `/datasources/new`
 *
 * This event corresponds to the start event of our data source creation funnel.
 * Combined with the end event, it allows answering questions about:
 * - Conversion (percentage of user that successfully set up a data source)
 * - Time spent on the config page
 *
 * Dashboard: Ad0pti0N
 * Changelog:
 * - v9.2.0 : logging datasource_id, grafana version and the source of event
 */
export const trackAzureMonitorDataSourceCreated = (props: AzureMonitorDataSourceCreatedProps) => {
  reportInteraction('grafana_ds_azuremonitor_add_datasource_clicked', props);
};

type AzureMonitorDataSourceCreatedProps = {
  grafana_version?: string;
  datasource_id: string;
  source: 'plugins/azure' | 'datasources/new';
};
