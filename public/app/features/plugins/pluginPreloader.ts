import type {
  PluginExtensionAddedLinkConfig,
  PluginExtensionExposedComponentConfig,
  PluginExtensionAddedComponentConfig,
} from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { importAppPlugin } from './pluginLoader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  exposedComponentConfigs: PluginExtensionExposedComponentConfig[];
  addedComponentConfigs?: PluginExtensionAddedComponentConfig[];
  addedLinkConfigs?: PluginExtensionAddedLinkConfig[];
};

const preloadPromises = new Map<string, Promise<void>>();

export const clearPreloadedPluginsCache = () => {
  preloadPromises.clear();
};

export async function preloadPlugins(apps: AppPluginConfig[] = []) {
  // Create preload promises for each app, reusing existing promises if already loading
  const promises = apps.map((app) => {
    if (!preloadPromises.has(app.id)) {
      preloadPromises.set(app.id, preload(app));
    }
    return preloadPromises.get(app.id)!;
  });

  await Promise.all(promises);
}

async function preload(config: AppPluginConfig): Promise<void> {
  try {
    const meta = await getPluginSettings(config.id, {
      showErrorAlert: contextSrv.user.orgRole !== '',
    });

    await importAppPlugin(meta);
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${config.path} (version: ${config.version})`, error);
  }
}
