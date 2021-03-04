import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { getDatasourceByName } from './config';

export enum DataSourceType {
  Alertmanager = 'grafana-alertmanager-datasource',
  Loki = 'loki',
  Prometheus = 'prometheus',
}

// using ds proxy only temporarily until the new alerting API is running
export function datasourceRequest<T = any>(
  dataSourceName: string,
  path: string,
  options: Partial<BackendSrvRequest> = {}
) {
  const datasource = getDatasourceByName(dataSourceName);
  if (!datasource) {
    throw new Error(`No datasource called ${dataSourceName} found.`);
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
