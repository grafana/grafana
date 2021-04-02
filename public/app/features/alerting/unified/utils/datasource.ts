import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { RulesSource } from 'app/types/unified-alerting';
import { getAllDataSources } from './config';

export const GRAFANA_RULES_SOURCE_NAME = 'grafana';

export enum DataSourceType {
  Alertmanager = 'alertmanager',
  Loki = 'loki',
  Prometheus = 'prometheus',
}

export const RulesDataSourceTypes: string[] = [DataSourceType.Loki, DataSourceType.Prometheus];

export function getRulesDataSources() {
  return getAllDataSources()
    .filter((ds) => RulesDataSourceTypes.includes(ds.type))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getLotexDataSourceByName(dataSourceName: string): DataSourceInstanceSettings {
  const dataSource = getDataSourceByName(dataSourceName);
  if (!dataSource) {
    throw new Error(`Data source ${dataSourceName} not found`);
  }
  if (dataSource.type !== DataSourceType.Loki && dataSource.type !== DataSourceType.Prometheus) {
    throw new Error(`Unexpected data source type ${dataSource.type}`);
  }
  return dataSource;
}

export function isCloudRulesSource(rulesSource: RulesSource): rulesSource is DataSourceInstanceSettings {
  return rulesSource !== 'grafana';
}

export function getDataSourceByName(name: string): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getAllDataSources().find((source) => source.name === name);
}

export function getDatasourceAPIId(dataSourceName: string): string {
  if (dataSourceName === 'grafana') {
    return 'grafana';
  }
  const ds = getDataSourceByName(dataSourceName);
  if (!ds) {
    throw new Error(`Data source ${dataSourceName} not found`);
  }
  return String(ds.id);
}
