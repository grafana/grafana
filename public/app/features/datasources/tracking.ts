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
 * - v9.2.0 : logging datasource, datasource_uid, grafana version and the source of event
 */
export const trackDataSourceCreated = (props: DataSourceCreatedProps) => {
  reportInteraction('grafana_ds_add_datasource_clicked', props);
};

type DataSourceCreatedProps = {
  grafana_version?: string;
  /** The unique id of the newly created data source */
  datasource_uid: string;
  /** The datasource type (e.g. Cloudwatch, Loki, Prometheus) */
  datasource: string;
  /** The source the event originated from, whether the plugin info page, or the list of datasources */
  source: string;
};
