import type {
  PluginExtensionAddedLinkConfig,
  PluginExtensionExposedComponentConfig,
  PluginExtensionAddedComponentConfig,
} from '@grafana/data';
import type { AppPluginConfig } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { importAppPlugin } from './plugin_loader';

export type PluginPreloadResult = {
  pluginId: string;
  error?: unknown;
  exposedComponentConfigs: PluginExtensionExposedComponentConfig[];
  addedComponentConfigs?: PluginExtensionAddedComponentConfig[];
  addedLinkConfigs?: PluginExtensionAddedLinkConfig[];
};

const preloadedAppPlugins = new Set<string>();
const isNotYetPreloaded = ({ id }: AppPluginConfig) => !preloadedAppPlugins.has(id);

export async function preloadPlugins(apps: AppPluginConfig[] = []) {
  const appPluginsToPreload = apps.filter(isNotYetPreloaded);

  if (appPluginsToPreload.length === 0) {
    return;
  }

  await Promise.all(appPluginsToPreload.map(preload));
}

async function preload(config: AppPluginConfig) {
  try {
    const meta = await getPluginSettings(config.id, {
      showErrorAlert: contextSrv.user.orgRole !== '',
    });

    await importAppPlugin(meta);

    preloadedAppPlugins.add(config.id);
  } catch (error) {
    console.error(`[Plugins] Failed to preload plugin: ${config.path} (version: ${config.version})`, error);
  }
}
