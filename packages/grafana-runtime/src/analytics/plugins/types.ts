import { PluginType } from '@grafana/data';

export interface PluginEventProperties {
  grafana_version: string;
  plugin_type: PluginType;
  plugin_version: string;
  plugin_id: string;
  plugin_name: string;
}
