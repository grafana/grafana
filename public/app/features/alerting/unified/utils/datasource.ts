import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { RulesSource } from 'app/types/unified-alerting';
import { getAllDataSources } from './config';

export enum DataSourceType {
  Alertmanager = 'grafana-alertmanager-datasource',
  Loki = 'loki',
  Prometheus = 'prometheus',
}

export const RulesDataSourceTypes: string[] = [DataSourceType.Loki, DataSourceType.Prometheus];

// using ds proxy only temporarily until the new alerting API is running
export function dataSourceRequest<T = any>(
  dataSourceName: string,
  path: string,
  options: Partial<BackendSrvRequest> = {}
) {
  const datasource = getDataSourceByName(dataSourceName);
  if (!datasource) {
    throw new Error(`No datasource calle\d ${dataSourceName} found.`);
  }

  const _options: BackendSrvRequest = {
    headers: {},
    method: 'GET',
    url: datasource.url + path,
    ...options,
  };

  if (datasource.basicAuth || datasource.withCredentials) {
    _options.credentials = 'include';
  }

  if (datasource.basicAuth && _options.headers) {
    _options.headers.Authorization = datasource.basicAuth;
  }

  return getBackendSrv().fetch<T>(_options).toPromise();
}

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
