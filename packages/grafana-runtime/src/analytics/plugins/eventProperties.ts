import { DataSourceInstanceSettings, PluginMeta, PluginType } from '@grafana/data';

import { config } from '../../config';

export interface PluginEventProperties {
  grafana_version: string;
  plugin_type: PluginType;
  plugin_version: string;
  plugin_id: string;
  plugin_name: string;
}

export function createPluginEventProperties(meta: PluginMeta): PluginEventProperties {
  return {
    grafana_version: config.buildInfo.version,
    plugin_type: meta.type,
    plugin_version: meta.info.version,
    plugin_id: meta.id,
    plugin_name: meta.name,
  };
}

export function createDataSourcePluginEventProperties(
  meta: PluginMeta,
  settings: DataSourceInstanceSettings
): PluginEventProperties {
  return createPluginEventProperties(meta);
}
