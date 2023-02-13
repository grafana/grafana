import { AppPluginConfig } from '@grafana/runtime';

import { setPreloadPluginConfig } from './pluginPreloadConfigs';
import { importPluginModule } from './plugin_loader';

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<void> {
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

async function preloadPlugin(plugin: AppPluginConfig): Promise<void> {
  const { path, version, id } = plugin;
  try {
    const { plugin } = await importPluginModule(path, version);
    const { extensionConfigs } = plugin;

    setPreloadPluginConfig(id, { extensionConfigs });
  } catch (error) {
    setPreloadPluginConfig(id, { error });
    console.error(`Failed to load plugin: ${path} (version: ${version})`, error);
  }
}
