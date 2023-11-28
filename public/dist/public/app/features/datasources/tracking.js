import { reportInteraction } from '@grafana/runtime';
/**
 * Used to track data source creation via either the specific plugin page `/plugins/<the-data-source>`
 * or the general datasources page `/datasources/new`
 *
 * This event corresponds to the start event of our data source creation funnel.
 * Combined with the end event, it allows answering questions about:
 * - Conversion (percentage of user that successfully set up a data source)
 * - Time spent on the config page
 *
 * Changelog:
 * - v9.1.7 : logging datasource, datasource_uid, grafana version
 */
export const trackDataSourceCreated = (props) => {
    reportInteraction('grafana_ds_add_datasource_clicked', props);
};
/**
 * Used to track data source testing
 *
 * This event corresponds to the end event of our data source creation funnel.
 * Combined with the start event, it allows answering questions about:
 * - Conversion (percentage of user that successfully set up a data source)
 * - Time spent on the config page
 *
 * Changelog:
 * - v9.1.7 : logging datasource, datasource_uid, grafana version and success
 */
export const trackDataSourceTested = (props) => {
    reportInteraction('grafana_ds_test_datasource_clicked', props);
};
export const trackExploreClicked = (props) => {
    reportInteraction('grafana_ds_explore_datasource_clicked', props);
};
export const trackCreateDashboardClicked = (props) => {
    reportInteraction('grafana_ds_create_dashboard_clicked', props);
};
export const trackDataSourcesListViewed = (props) => {
    reportInteraction('grafana_ds_datasources_list_viewed', props);
};
export const trackDsConfigClicked = (item) => {
    reportInteraction('connections_datasources_settings_clicked', { item });
};
export const trackDsConfigUpdated = (props) => {
    reportInteraction('connections_datasources_ds_configured', props);
};
//# sourceMappingURL=tracking.js.map