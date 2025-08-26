import { DataSourceInstanceSettings, DataSourceJsonData, PluginMetaInfo, PluginType } from '@grafana/data';
import { setBackendSrv, getBackendSrv } from '@grafana/runtime';

export const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: 'pyroscope',
  type: 'profiling',
  name: 'pyroscope',
  access: 'proxy',
  meta: {
    id: 'pyroscope',
    name: 'pyroscope',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
  readOnly: false,
};

/** The datasource QueryEditor fetches datasource settings to send to the extension's `configure` method */

export function mockFetchPyroscopeDatasourceSettings(
  datasourceSettings?: Partial<DataSourceInstanceSettings<DataSourceJsonData>>
) {
  const settings = { ...defaultSettings, ...datasourceSettings };
  const returnValues: Record<string, unknown> = {
    [`/api/datasources/uid/${settings.uid}`]: settings,
  };
  setBackendSrv({
    ...getBackendSrv(),
    get: function <T>(path: string) {
      const value = returnValues[path];
      if (value) {
        return Promise.resolve(value as T);
      }
      return Promise.reject({ message: 'reject' });
    },
  });
}
