import { LinkExtensionCallback } from '@grafana/data';
import { AppPluginConfig } from '@grafana/runtime';

import { importPluginModule } from './plugin_loader';

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<void> {
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

async function preloadPlugin(plugin: AppPluginConfig): Promise<void> {
  const { path, version, id } = plugin;
  try {
    const { plugin } = await importPluginModule(path, version);
    setPluginExtensionConfigs(id, plugin.extensionOverrides);
  } catch (error: unknown) {
    // TODO: handle case where the plugin failed to load causing broken extension links
    console.error(`Failed to load plugin: ${path} (version: ${version})`, error);
  }
}

let configs: Record<string, LinkExtensionCallback> = {};

function setPluginExtensionConfigs(pluginId: string, overrides: Record<string, LinkExtensionCallback> = {}) {
  for (const [overrideId, override] of Object.entries(overrides)) {
    configs[`${pluginId}.${overrideId}`] = override;
  }
}

export function getPluginExtensionConfig(pluginId: string, overrideId: string) {
  return configs[`${pluginId}.${overrideId}`];
}
