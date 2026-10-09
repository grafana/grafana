import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

/**
 * Instance settings for a test data source, with the plugin meta the lookup and list APIs read
 * (`type`, `mixed`, `metrics`). Seed them with `setDataSourceInstanceSettings` or `seedDataSources`.
 */
export function makeDataSourceSettings(
  uid: string,
  name: string,
  type: string,
  opts: { isDefault?: boolean; mixed?: boolean } = {}
): DataSourceInstanceSettings {
  return {
    id: 1,
    uid,
    name,
    type,
    access: 'direct',
    jsonData: {},
    readOnly: false,
    isDefault: opts.isDefault ?? false,
    meta: {
      id: type,
      name: type,
      type: 'datasource',
      module: '',
      baseUrl: '',
      mixed: opts.mixed ?? false,
      metrics: true,
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { small: '', large: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
    } as unknown as DataSourcePluginMeta,
  } as DataSourceInstanceSettings;
}
