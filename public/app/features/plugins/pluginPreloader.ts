import { PreloadPlugin } from '@grafana/data';

import { importPluginModule } from './plugin_loader';

export async function preloadPlugins(pluginsToPreload: PreloadPlugin[] = []): Promise<void> {
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

async function preloadPlugin(plugin: PreloadPlugin): Promise<void> {
  const { path, version } = plugin;
  try {
    await importPluginModule(path, version);
  } catch (error: unknown) {
    console.error(`Failed to load plugin: ${path} (version: ${version})`, error);
  }
}
