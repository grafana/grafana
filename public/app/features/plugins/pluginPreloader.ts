import {
  type AppPluginConfig,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionExposedComponentConfig,
  type PluginExtensionAddedComponentConfig,
  PluginExtensionPoints,
} from '@grafana/data';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { getAppPluginsToAwait, getExtensionPointPluginDependencies } from './extensions/appUtils';
import { pluginImporter } from './importer/pluginImporter';

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

export async function preloadAppPluginsToAwait() {
  const apps = await getAppPluginMetas();
  const appsToAwait = getAppPluginsToAwait(apps);

  return preloadPlugins(appsToAwait);
}

export async function preloadAppPluginsToPreload() {
  const apps = await getAppPluginMetas();
  // The DashboardPanelMenu extension point is using the `getPluginExtensions()` API in scenes at the moment, which means that it cannot yet benefit from dynamic plugin loading.
  const dashboardPanelMenuPluginIds = getExtensionPointPluginDependencies(
    PluginExtensionPoints.DashboardPanelMenu,
    apps
  );
  const awaitedPluginIds = getAppPluginsToAwait(apps).map((app) => app.id);
  const isNotAwaited = (app: AppPluginConfig) => !awaitedPluginIds.includes(app.id);
  const appPluginsToPreload = apps.filter(
    (app) => isNotAwaited(app) && (app.preload || dashboardPanelMenuPluginIds.includes(app.id))
  );

  return preloadPlugins(appPluginsToPreload);
}

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

  try {
    const meta = await getPluginSettings(config.id, { showErrorAlert });
    await pluginImporter.importApp(meta);
  } catch (error) {
    if (!showErrorAlert) {
      return;
    }

    console.error(`[Plugins] Failed to preload plugin: ${config.path} (version: ${config.version})`, error);
  }
}
