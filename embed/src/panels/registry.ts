import { PluginType, type PanelPlugin, type PanelPluginMeta } from '@grafana/data';

import { timeseries } from './timeseries';
import { type EmbedPanelType } from './types';

/**
 * The embeddable equivalent of Grafana's panel plugin registry, without module
 * federation or @grafana/runtime. Panel components are statically linked at build
 * time, so adding an entry here is what widens the panel-JSON surface an embed draws.
 */
const types = new Map<string, EmbedPanelType>();
const plugins = new Map<string, PanelPlugin>();

export function registerPanelType(type: EmbedPanelType) {
  types.set(type.pluginId, type);
  plugins.delete(type.pluginId);
}

export function getPanelType(pluginId: string): EmbedPanelType | undefined {
  return types.get(pluginId);
}

/**
 * GrafanaPlugin.meta is normally filled in by the plugin loading system, so a
 * hand-built PanelPlugin has none and hasPluginId() / createFieldConfigRegistry()
 * would throw on it. Statically linked panels get a minimal one here.
 */
function embedPluginMeta(pluginId: string): PanelPluginMeta {
  const meta: PanelPluginMeta = {
    id: pluginId,
    name: pluginId,
    type: PluginType.panel,
    sort: 0,
    module: '',
    baseUrl: '',
    info: {
      author: { name: 'Grafana Labs' },
      description: '',
      links: [],
      logos: { small: '', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
  };
  return meta;
}

/** Plugins are built lazily and cached: constructing one runs the field config builder. */
export function getPanelPlugin(pluginId: string): PanelPlugin | undefined {
  const type = types.get(pluginId);
  if (!type) {
    return undefined;
  }
  let plugin = plugins.get(pluginId);
  if (!plugin) {
    plugin = type.createPlugin();
    // Must precede any fieldConfigRegistry read: the registry factory uses meta.name.
    plugin.meta = embedPluginMeta(pluginId);
    plugins.set(pluginId, plugin);
  }
  return plugin;
}

export function registeredPanelTypes(): string[] {
  return [...types.keys()];
}

registerPanelType(timeseries);
