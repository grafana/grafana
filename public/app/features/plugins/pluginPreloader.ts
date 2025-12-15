import {
  type AppPluginConfig,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionExposedComponentConfig,
  type PluginExtensionAddedComponentConfig,
  PluginExtensionPoints,
} from '@grafana/data';
import { getAppPluginMetas } from '@grafana/runtime/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { getExtensionPointPluginDependencies } from './extensions/utils';
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

function getAppPluginIdsToAwait() {
  const pluginIds = [
    // The "cloud-home-app" is registering banners once it's loaded, and this can cause a rerender in the AppChrome if it's loaded after the Grafana app init.
    'cloud-home-app',
  ];

  return pluginIds;
}

function isNotAwaited(app: AppPluginConfig) {
  return !getAppPluginIdsToAwait().includes(app.id);
}

export async function preloadPluginsToBeAwaited() {
  const apps = await getAppPluginMetas();
  const awaited = getAppPluginIdsToAwait();
  const filtered = apps.filter((app) => awaited.includes(app.id));

  preloadPlugins(filtered);
}

export async function preloadPluginsToBePreloaded() {
  const apps = await getAppPluginMetas();

  // The DashboardPanelMenu extension point is using the `getPluginExtensions()` API in scenes at the moment, which means that it cannot yet benefit from dynamic plugin loading.
  const dashboardPanelMenuPluginIds = getExtensionPointPluginDependencies(
    apps,
    PluginExtensionPoints.DashboardPanelMenu
  );

  const filtered = apps.filter((app) => {
    return isNotAwaited(app) && (app.preload || dashboardPanelMenuPluginIds.includes(app.id));
  });

  preloadPlugins(filtered);
}

export type PreloadAppPluginsPredicate = (apps: AppPluginConfig[], extensionId: string) => string[];

const noop: PreloadAppPluginsPredicate = () => [];

export async function preloadPluginsWithPredicate(extensionId: string, predicate: PreloadAppPluginsPredicate = noop) {
  const apps = await getAppPluginMetas();
  const filteredIds = predicate(apps, extensionId);
  const filtered = apps.filter((app) => filteredIds.includes(app.id));

  if (!filtered.length) {
    return;
  }

  preloadPlugins(filtered);
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
