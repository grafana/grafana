import { DataSourceSettings } from '@grafana/data';

export function createDatasourceSettings<T>(jsonData: T): DataSourceSettings<T> {
  return {
    id: 0,
    orgId: 0,
    name: 'datasource-test',
    typeLogoUrl: '',
    type: 'datasource',
    access: 'server',
    url: 'http://localhost',
    password: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthPassword: '',
    basicAuthUser: '',
    isDefault: false,
    jsonData,
    readOnly: false,
    withCredentials: false,
  };
}
