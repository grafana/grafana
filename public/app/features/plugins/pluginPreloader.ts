import { PluginsExtensionLinkConfigurer } from '@grafana/data';
import { AppPluginConfig } from '@grafana/runtime';

import { importPluginModule } from './plugin_loader';

type PreloadPluginConfig = {
  error?: unknown;
  extensionConfigs?: Record<string, PluginsExtensionLinkConfigurer>;
};

const configs: Record<string, PreloadPluginConfig> = {};

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<void> {
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

export function getPreloadPluginConfig(id: string): PreloadPluginConfig | undefined {
  return configs[id];
}

async function preloadPlugin(config: AppPluginConfig): Promise<void> {
  const { path, version, id: pluginId } = config;
  try {
    const { plugin } = await importPluginModule(path, version);
    const { extensionConfigs } = plugin;

    configs[pluginId] = { extensionConfigs };
  } catch (error) {
    configs[pluginId] = { error };
    console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
  }
}
