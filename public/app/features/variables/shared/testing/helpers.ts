import type { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data/types';

export function getDataSourceInstanceSetting(name: string, meta: DataSourcePluginMeta): DataSourceInstanceSettings {
  return {
    uid: name,
    type: '',
    name,
    meta,
    access: 'proxy',
    jsonData: {},
    readOnly: false,
  };
}
