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
    const { extensionOverrides } = plugin;

    setPluginLoadedConfig({ id, hasLoaded: true, extensionOverrides });
  } catch (error: unknown) {
    setPluginLoadedConfig({ id, hasLoaded: false });
    console.error(`Failed to load plugin: ${path} (version: ${version})`, error);
  }
}

const pluginLoadedConfig: Record<
  string,
  {
    // Is TRUE if the plugin was successfully loaded and initialised
    hasLoaded: boolean;
    // An optional list of dynacmic overrides for plugin extensions based on the context runtime
    extensionOverrides?: Record<string, LinkExtensionCallback>;
  }
> = {};

function setPluginLoadedConfig({
  id,
  hasLoaded,
  extensionOverrides,
}: {
  id: string;
  hasLoaded: boolean;
  extensionOverrides?: Record<string, LinkExtensionCallback>;
}) {
  pluginLoadedConfig[id] = {
    hasLoaded,
    extensionOverrides,
  };
}

export function getPluginLoadedConfig(id: string) {
  return pluginLoadedConfig[id];
}
