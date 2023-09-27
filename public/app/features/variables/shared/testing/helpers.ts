import { DataSourceInstanceSettings, DataSourceJsonData, DataSourcePluginMeta } from '@grafana/data';

export function getDataSourceInstanceSetting(name: string, meta: DataSourcePluginMeta): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: name,
    type: '',
    name,
    meta,
    access: 'proxy',
    jsonData: {} as unknown as DataSourceJsonData,
    readOnly: false,
  };
}
