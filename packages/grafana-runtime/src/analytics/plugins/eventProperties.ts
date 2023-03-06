import { DataSourceInstanceSettings, PluginMeta } from '@grafana/data';

import { config } from '../../config';

export type PluginEventProperties = {
  grafana_version: string;
  plugin_type: string;
  plugin_version: string;
  plugin_id: string;
  plugin_name: string;
};

export function createPluginEventProperties(meta: PluginMeta): PluginEventProperties {
  return {
    grafana_version: config.buildInfo.version,
    plugin_type: String(meta.type),
    plugin_version: meta.info.version,
    plugin_id: meta.id,
    plugin_name: meta.name,
  };
}

export type DataSourcePluginEventProperties = PluginEventProperties & {
  datasource_uid: string;
};

export function createDataSourcePluginEventProperties(
  instanceSettings: DataSourceInstanceSettings
): DataSourcePluginEventProperties {
  return {
    ...createPluginEventProperties(instanceSettings.meta),
    datasource_uid: instanceSettings.uid,
  };
}
