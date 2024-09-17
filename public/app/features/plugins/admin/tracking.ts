import { reportInteraction } from '@grafana/runtime';

type PluginTrackingProps = {
  // The ID of the plugin (e.g. grafana-azure-monitor-datasource)
  plugin_id: string;
  // The type of the plugin (e.g. 'app' or 'datasource')
  plugin_type?: string;
  // The path where the plugin details page was rendered (e.g. /plugins/grafana-azure-monitor-datasource )
  path: string;
};

export const trackPluginInstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_install_clicked', props);
};

export const trackPluginUninstalled = (props: PluginTrackingProps) => {
  reportInteraction('grafana_plugin_uninstall_clicked', props);
};
