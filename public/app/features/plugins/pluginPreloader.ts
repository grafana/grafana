import type { PluginExtensionAddedLinkConfig, PluginExtensionExposedComponentConfig } from '@grafana/data';
import { PluginExtensionAddedComponentConfig } from '@grafana/data/src/types/pluginExtensions';
import type { AppPluginConfig } from '@grafana/runtime';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { PluginExtensionRegistries } from './extensions/registry/types';
import { importPluginModule } from './plugin_loader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  exposedComponentConfigs: PluginExtensionExposedComponentConfig[];
  addedComponentConfigs?: PluginExtensionAddedComponentConfig[];
  addedLinkConfigs?: PluginExtensionAddedLinkConfig[];
};

// The list of already preloaded plugin ids.
// (We only want to preload plugins once, as we would like to avoid error messages caused by
// registering extensions multiple times.)
const preloadedPluginsCache = new Set<string>();

export async function preloadPlugins(apps: AppPluginConfig[] = [], registries: PluginExtensionRegistries) {
  const isNotPreloaded = ({ id }: AppPluginConfig) => !preloadedPluginsCache.has(id);
  const promises = apps.filter(isNotPreloaded).map((config) => preload(config));
  const preloadedPlugins = await Promise.all(promises);

  for (const preloadedPlugin of preloadedPlugins) {
    if (preloadedPlugin.error) {
      console.error(`[Plugins] Skip loading extensions for "${preloadedPlugin.pluginId}" due to an error.`);
      continue;
    }

    registries.exposedComponentsRegistry.register({
      pluginId: preloadedPlugin.pluginId,
      configs: preloadedPlugin.exposedComponentConfigs,
    });
    registries.addedComponentsRegistry.register({
      pluginId: preloadedPlugin.pluginId,
      configs: preloadedPlugin.addedComponentConfigs || [],
    });
    registries.addedLinksRegistry.register({
      pluginId: preloadedPlugin.pluginId,
      configs: preloadedPlugin.addedLinkConfigs || [],
    });
  }
}

async function preload(config: AppPluginConfig): Promise<PluginPreloadResult> {
  const { path, version, id: pluginId, loadingStrategy } = config;
  try {
    const { plugin } = await importPluginModule({
      path,
      version,
      isAngular: config.angular.detected,
      pluginId,
      loadingStrategy,
      moduleHash: config.moduleHash,
    });
    const { exposedComponentConfigs = [], addedComponentConfigs = [], addedLinkConfigs = [] } = plugin;

    // Fetching meta-information for the preloaded app plugin and caching it for later.
    // (The function below returns a promise, but it's not awaited for a reason: we don't want to block the preload process, we would only like to cache the result for later.)
    getPluginSettings(pluginId);

    return { pluginId, exposedComponentConfigs, addedComponentConfigs, addedLinkConfigs };
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
    return {
      pluginId,
      error,
      exposedComponentConfigs: [],
      addedComponentConfigs: [],
      addedLinkConfigs: [],
    };
  }
}
