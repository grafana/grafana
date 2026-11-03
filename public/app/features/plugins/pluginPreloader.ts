import type { AppPluginConfig } from '@grafana/data';
import { getPluginSettings } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { setPluginLoadState } from './extensions/pluginLoadState';
import { pluginImporter } from './importer/pluginImporter';

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
  const showErrorAlert = contextSrv.user.orgRole !== '';

  setPluginLoadState(config.id, { status: 'loading' });
  try {
    const meta = await getPluginSettings(config.id, showErrorAlert);
    await pluginImporter.importApp(meta);
    setPluginLoadState(config.id, { status: 'loaded' });
  } catch (error) {
    setPluginLoadState(config.id, {
      status: 'failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    if (!showErrorAlert) {
      return;
    }

    console.error(`[Plugins] Failed to preload plugin: ${config.path} (version: ${config.version})`, error);
  }
}
