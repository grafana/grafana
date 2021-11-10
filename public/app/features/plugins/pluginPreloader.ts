import { importPluginModule } from './plugin_loader';

export async function preloadPlugins(pluginsToPreload: string[] = []): Promise<void> {
  await Promise.all(pluginsToPreload.map(preloadPlugin));
}

async function preloadPlugin(path: string): Promise<void> {
  try {
    await importPluginModule(path);
  } catch (error: unknown) {
    console.error(`Failed to load plugin: ${path}`, error);
  }
}
