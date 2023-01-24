import { AppPluginConfig } from '@grafana/runtime';

import { importPluginModule } from './plugin_loader';

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<void> {
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

async function preloadPlugin(plugin: AppPluginConfig): Promise<void> {
  const { path, version } = plugin;
  try {
    await importPluginModule(path, version);
  } catch (error: unknown) {
    console.error(`Failed to load plugin: ${path} (version: ${version})`, error);
  }
}
