import { config, GrafanaBootConfig } from '@grafana/runtime';
import { PluginState } from '../../../packages/grafana-data/src';
// Legacy binding paths
export { config, GrafanaBootConfig as Settings };

let grafanaConfig: GrafanaBootConfig = config;

export default grafanaConfig;

export const getConfig = () => {
  return grafanaConfig;
};

export const updateConfig = (update: Partial<GrafanaBootConfig>) => {
  grafanaConfig = {
    ...grafanaConfig,
    ...update,
  };
};

// The `enable_alpha` flag is no exposed directly, this is equivolant
export const hasAlphaPanels = Boolean(config.panels?.debug?.state === PluginState.alpha);
