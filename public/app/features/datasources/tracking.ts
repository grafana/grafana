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
export const trackDataSourceCreated = (props: DataSourceCreatedProps) => {
  reportInteraction('grafana_ds_add_datasource_clicked', props);
};

type DataSourceCreatedProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The datasource id (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_id: string;
  /** The plugin version (especially interesting in external plugins - core plugins are aligned with grafana version) */
  plugin_version?: string;
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
export const trackDataSourceTested = (props: DataSourceTestedProps) => {
  reportInteraction('grafana_ds_test_datasource_clicked', props);
};

type DataSourceTestedProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The datasource id (e.g. Cloudwatch, Loki, Prometheus) */
  plugin_id: string;
  /** The plugin version (especially interesting in external plugins - core plugins are aligned with grafana version) */
  plugin_version?: string;
  /** Whether or not the datasource test succeeded = the datasource was successfully configured */
  success: boolean;
};
