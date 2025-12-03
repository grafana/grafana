import type {
  PluginExtensionAddedLinkConfig,
  PluginExtensionExposedComponentConfig,
  PluginExtensionAddedComponentConfig,
  Spec,
} from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

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

export async function preloadPlugins(apps: Spec[] = []) {
  // Create preload promises for each app, reusing existing promises if already loading
  const promises = apps.map((app) => {
    if (!preloadPromises.has(app.pluginJson.id)) {
      preloadPromises.set(app.pluginJson.id, preload(app));
    }
    return preloadPromises.get(app.pluginJson.id)!;
  });

  await Promise.all(promises);
}

async function preload(config: Spec): Promise<void> {
  const showErrorAlert = contextSrv.user.orgRole !== '';

  try {
    const meta = await getPluginSettings(config.pluginJson.id, { showErrorAlert });
    await pluginImporter.importApp(meta);
  } catch (error) {
    if (!showErrorAlert) {
      return;
    }

    console.error(
      `[Plugins] Failed to preload plugin: ${config.module.path} (version: ${config.pluginJson.info.version})`,
      error
    );
  }
}
