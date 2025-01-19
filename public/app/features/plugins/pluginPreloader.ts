import type { PluginExtensionAddedLinkConfig, PluginExtensionExposedComponentConfig } from '@grafana/data';
import { PluginExtensionAddedComponentConfig } from '@grafana/data/src/types/pluginExtensions';

import { loadPlugin } from './utils';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  exposedComponentConfigs: PluginExtensionExposedComponentConfig[];
  addedComponentConfigs?: PluginExtensionAddedComponentConfig[];
  addedLinkConfigs?: PluginExtensionAddedLinkConfig[];
};

interface PluginConfig {
  id: string;
  moduleHash?: string;
}

const preloadedAppPlugins = new Set<string>();
const isNotYetPreloaded = ({ id }: PluginConfig) => !preloadedAppPlugins.has(id);
const markAsPreloaded = (configs: PluginConfig[]) => configs.forEach(({ id }) => preloadedAppPlugins.add(id));

export async function preloadPlugins(configs: PluginConfig[] = []) {
  const appPluginsToPreload = configs.filter(isNotYetPreloaded);

  if (appPluginsToPreload.length === 0) {
    return;
  }

  markAsPreloaded(configs);

  await Promise.all(appPluginsToPreload.map(preload));
}

async function preload(config: PluginConfig) {
  try {
    await loadPlugin(config.id);
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${config.id} (version: ${config.moduleHash})`, error);
  }
}
