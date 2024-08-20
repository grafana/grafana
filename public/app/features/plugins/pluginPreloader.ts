import type { PluginExposedComponentConfig, PluginExtensionConfig } from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { ReactivePluginExtensionsRegistry } from './extensions/reactivePluginExtensionRegistry';
import { ExposedComponentsRegistry } from './extensions/registry/ExposedComponentsRegistry';
import * as pluginLoader from './plugin_loader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  extensionConfigs: PluginExtensionConfig[];
  exposedComponentConfigs: PluginExposedComponentConfig[];
};

export async function preloadPlugins(
  apps: AppPluginConfig[] = [],
  registry: ReactivePluginExtensionsRegistry,
  exposedComponentsRegistry: ExposedComponentsRegistry,
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

    registry.register(preloadedPlugin);

    exposedComponentsRegistry.register({
      pluginId: preloadedPlugin.pluginId,
      configs: preloadedPlugin.exposedComponentConfigs,
    });
  }

  stopMeasure(eventName);
}

async function preload(config: AppPluginConfig): Promise<PluginPreloadResult> {
  const { path, version, id: pluginId } = config;
  try {
    startMeasure(`frontend_plugin_preload_${pluginId}`);
    const { plugin } = await pluginLoader.importPluginModule({
      path,
      version,
      isAngular: config.angular.detected,
      pluginId,
    });
    const { extensionConfigs = [], exposedComponentConfigs = [] } = plugin;

    // Fetching meta-information for the preloaded app plugin and caching it for later.
    // (The function below returns a promise, but it's not awaited for a reason: we don't want to block the preload process, we would only like to cache the result for later.)
    getPluginSettings(pluginId);

    return { pluginId, extensionConfigs, exposedComponentConfigs };
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
    return { pluginId, extensionConfigs: [], error, exposedComponentConfigs: [] };
  } finally {
    stopMeasure(`frontend_plugin_preload_${pluginId}`);
  }
}
