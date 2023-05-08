import type {
  PluginExtensionLinkConfig,
  TransformerPlugin,
  Registry,
  TransformerRegistryItem,
  TransformerPluginMeta
} from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';

import * as pluginLoader from './plugin_loader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  extensionConfigs: PluginExtensionLinkConfig[];
};

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<PluginPreloadResult[]> {
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  return Promise.all(pluginsToPreload.map(preload));
}

async function preload(config: AppPluginConfig): Promise<PluginPreloadResult> {
  const { path, version, id: pluginId } = config;
  try {
    const { plugin } = await pluginLoader.importPluginModule(path, version);
    const { extensionConfigs = [] } = plugin;
    return { pluginId, extensionConfigs };
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
    return { pluginId, extensionConfigs: [], error };
  }
}

export async function loadTransformerPlugins(transformerPlugins: Record<string, TransformerPluginMeta>, transformRegistry: Registry<TransformerRegistryItem<any>>){
  const pluginsToPreload = Object.values(transformerPlugins);
  return Promise.all(pluginsToPreload.map(loadTransformerPlugin)).then(values => values.forEach(v => v.transformers.forEach(t => transformRegistry.register(t))));
}

async function loadTransformerPlugin(config: TransformerPluginMeta): Promise<TransformerPlugin> {
  const { module, info } = config;
  try {
    return await pluginLoader.importPluginModule(module, info.version).then((pluginExports) => {
      const plugin = pluginExports.plugin as TransformerPlugin;
      plugin.meta = config;
      console.log(plugin)
      return plugin ;
    });
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${module} (version: ${info.version})`, error);
    throw error;
  }
}
