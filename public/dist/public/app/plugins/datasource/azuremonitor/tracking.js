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
export const trackAzureMonitorDashboardLoaded = (props) => {
    reportInteraction('grafana_ds_azuremonitor_dashboard_loaded', props);
};
//# sourceMappingURL=tracking.js.map