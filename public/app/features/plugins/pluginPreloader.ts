import type {
  PanelPluginMeta,
  PluginExtensionAddedLinkConfig,
  PluginExtensionExposedComponentConfig,
} from '@grafana/data';
import { PluginExtensionAddedComponentConfig } from '@grafana/data/src/types/pluginExtensions';
import type { AppPluginConfig } from '@grafana/runtime';

import { loadPlugin } from './utils';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  exposedComponentConfigs: PluginExtensionExposedComponentConfig[];
  addedComponentConfigs?: PluginExtensionAddedComponentConfig[];
  addedLinkConfigs?: PluginExtensionAddedLinkConfig[];
};

const preloadedAppPlugins = new Set<string>();
const isNotYetPreloaded = ({ id }: AppPluginConfig | PanelPluginMeta) => !preloadedAppPlugins.has(id);
const markAsPreloaded = (apps: Array<AppPluginConfig | PanelPluginMeta>) =>
  apps.forEach(({ id }) => preloadedAppPlugins.add(id));

export async function preloadPlugins(apps: Array<AppPluginConfig | PanelPluginMeta> = []) {
  const appPluginsToPreload = apps.filter(isNotYetPreloaded);

  if (appPluginsToPreload.length === 0) {
    return;
  }

  markAsPreloaded(apps);

  await Promise.all(appPluginsToPreload.map(preload));
}

async function preload(config: AppPluginConfig | PanelPluginMeta) {
  try {
    await loadPlugin(config.id);
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${config.id} (version: ${config.moduleHash})`, error);
  }
}
