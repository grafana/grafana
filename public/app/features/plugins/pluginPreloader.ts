import type { PluginExtensionConfig } from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import * as pluginLoader from './plugin_loader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  extensionConfigs: PluginExtensionConfig[];
};

export async function preloadPlugins(apps: Record<string, AppPluginConfig> = {}): Promise<PluginPreloadResult[]> {
  startMeasure('frontend_plugins_preload');
  const pluginsToPreload = Object.values(apps).filter((app) => app.preload);
  const result = await Promise.all(pluginsToPreload.map(preload));
  stopMeasure('frontend_plugins_preload');
  return result;
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
    const { extensionConfigs = [] } = plugin;

    // Fetching meta-information for the preloaded app plugin and caching it for later.
    // (The function below returns a promise, but it's not awaited for a reason: we don't want to block the preload process, we would only like to cache the result for later.)
    getPluginSettings(pluginId);

    return { pluginId, extensionConfigs };
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${path} (version: ${version})`, error);
    return { pluginId, extensionConfigs: [], error };
  } finally {
    stopMeasure(`frontend_plugin_preload_${pluginId}`);
  }
}
