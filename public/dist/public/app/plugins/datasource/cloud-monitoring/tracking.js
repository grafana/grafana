import { reportInteraction } from '@grafana/runtime';
/**
 * Loaded the first time a dashboard containing Cloudmonitoring queries is loaded (not on every render)
 * Note: The queries used here are the ones pre-migration and pre-filterQuery
 */
export const trackCloudMonitoringDashboardLoaded = (props) => {
    reportInteraction('grafana_ds_cloudmonitoring_dashboard_loaded', props);
};
//# sourceMappingURL=tracking.js.map