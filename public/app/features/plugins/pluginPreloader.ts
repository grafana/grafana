import type { PluginExtensionAddedLinkConfig, PluginExtensionExposedComponentConfig } from '@grafana/data';
import { PluginExtensionAddedComponentConfig } from '@grafana/data/src/types/pluginExtensions';
import type { AppPluginConfig } from '@grafana/runtime';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
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

export async function preloadPlugins(
  apps: AppPluginConfig[] = [],
  registries: PluginExtensionRegistries,
  eventName = 'frontend_plugins_preload'
) {
  startMeasure(eventName);
  const promises = apps.filter((config) => config.preload).map((config) => preload(config));
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

  stopMeasure(eventName);
}

async function preload(config: AppPluginConfig): Promise<PluginPreloadResult> {
  const { path, version, id: pluginId, loadingStrategy } = config;
  try {
    startMeasure(`frontend_plugin_preload_${pluginId}`);
    const { plugin } = await importPluginModule({
      path,
      version,
      isAngular: config.angular.detected,
      pluginId,
      loadingStrategy,
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
  } finally {
    stopMeasure(`frontend_plugin_preload_${pluginId}`);
  }
}
