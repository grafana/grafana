import { reportInteraction } from '@grafana/runtime';

type DataSourceGeneralTrackingProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The name of the datasource (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_name: string;
  /** The URL of the page where event was triggereed from. */
  path?: string;
};

export const trackExploreClicked = (props: DataSourceGeneralTrackingProps) => {
  reportInteraction('grafana_ds_explore_datasource_clicked', props);
};

export const trackCreateDashboardClicked = (props: DataSourceGeneralTrackingProps) => {
  reportInteraction('grafana_ds_create_dashboard_clicked', props);
};

export const trackDataSourcesListViewed = (props: { grafana_version?: string; path?: string }) => {
  reportInteraction('grafana_ds_datasources_list_viewed', props);
};

export const trackDsConfigClicked = (item: string) => {
  reportInteraction('connections_datasources_settings_clicked', { item });
};

export const trackDsConfigUpdated = (props: { item: string; error?: unknown }) => {
  reportInteraction('connections_datasources_ds_configured', props);
};
