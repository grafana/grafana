import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { RulesSource } from 'app/types/unified-alerting';
import { getAllDataSources } from './config';

export enum DataSourceType {
  Alertmanager = 'grafana-alertmanager-datasource',
  Loki = 'loki',
  Prometheus = 'prometheus',
}

export const RulesDatasourceTypes: string[] = [DataSourceType.Loki, DataSourceType.Prometheus];

// using ds proxy only temporarily until the new alerting API is running
export function datasourceRequest<T = any>(
  dataSourceName: string,
  path: string,
  options: Partial<BackendSrvRequest> = {}
) {
  const datasource = getDatasourceByName(dataSourceName);
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

export function getRulesDatasources() {
  return getAllDataSources()
    .filter((ds) => RulesDatasourceTypes.includes(ds.type))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getLotexDatasourceByName(datasourceName: string): DataSourceInstanceSettings {
  const datasource = getDatasourceByName(datasourceName);
  if (!datasource) {
    throw new Error(`Datasource ${datasourceName} not found`);
  }
  if (datasource.type !== DataSourceType.Loki && datasource.type !== DataSourceType.Prometheus) {
    throw new Error(`Unexpected datasource type ${datasource.type}`);
  }
  return datasource;
}

export function isCloudRulesSource(rulesSource: RulesSource): rulesSource is DataSourceInstanceSettings {
  return rulesSource !== 'grafana';
}

export function getDatasourceByName(name: string): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getAllDataSources().find((source) => source.name === name);
}
