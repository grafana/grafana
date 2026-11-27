import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

/**
 * The settings of a listed data source, or `undefined` when they are not known.
 *
 * Temporary: list items carry no `jsonData`, so this reads it from `config.datasources`. Keep every read of
 * `config.datasources` in this function. When Alerting has a backend API that returns the fields its data
 * source checks need, only this function changes.
 */
export function getAlertingDataSourceSettings(
  item: DataSourceInstanceListItem
): DataSourceInstanceSettings | undefined {
  // eslint-disable-next-line @grafana/no-config-datasources
  const settings = config.datasources[item.name];

  // A data source renamed since the page loaded can leave another data source under the same name.
  return settings?.uid === item.uid ? settings : undefined;
}
