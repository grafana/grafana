import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}
