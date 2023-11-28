import { reportInteraction } from '@grafana/runtime';
export const trackPluginInstalled = (props) => {
    reportInteraction('grafana_plugin_install_clicked', props);
};
export const trackPluginUninstalled = (props) => {
    reportInteraction('grafana_plugin_uninstall_clicked', props);
};
//# sourceMappingURL=tracking.js.map