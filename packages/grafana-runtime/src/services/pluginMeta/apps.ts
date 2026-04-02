import { type AppPluginConfig, PluginType } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';

import { FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import { logPluginMetaWarning } from './logging';
import { getAppPluginMapper } from './mappers/mappers';
import { initPluginMetas } from './plugins';
import type { AppPluginMetas, PluginMetasResponse } from './types';

let apps: AppPluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(apps).length);
}

function setApps(input: AppPluginMetas) {
  apps = input;
}

function setMetas(metas: PluginMetasResponse) {
  if (!metas.items.length) {
    // something failed while trying to fetch plugin meta
    // fallback to config.panels from bootdata
    // eslint-disable-next-line @grafana/no-config-apps
    setApps(config.apps);
    logPluginMetaWarning(FALLBACK_TO_BOOTDATA_WARNING, PluginType.app);
    return;
  }

  const mapper = getAppPluginMapper();
  setApps(mapper(metas));
}

async function initAppPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPlugins', false)) {
    // eslint-disable-next-line @grafana/no-config-apps
    setApps(config.apps);
    return;
  }

  const metas = await initPluginMetas();
  setMetas(metas);
}

export async function getAppPluginMetas(): Promise<AppPluginConfig[]> {
  if (!initialized()) {
    await initAppPluginMetas();
  }

  return Object.values(structuredClone(apps));
}

export async function getAppPluginMeta(pluginId: string): Promise<AppPluginConfig | null> {
  if (!initialized()) {
    await initAppPluginMetas();
  }

  const app = apps[pluginId];
  return app ? structuredClone(app) : null;
}

/**
 * Check if an app plugin is installed. The function does not check if the app plugin is enabled.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed, false otherwise.
 */
export async function isAppPluginInstalled(pluginId: string): Promise<boolean> {
  const app = await getAppPluginMeta(pluginId);
  return Boolean(app);
}

/**
 * Get the version of an app plugin.
 * @param pluginId - The id of the app plugin.
 * @returns The version of the app plugin, or null if the plugin is not installed.
 */
export async function getAppPluginVersion(pluginId: string): Promise<string | null> {
  const app = await getAppPluginMeta(pluginId);
  return app?.version ?? null;
}

export function setAppPluginMetas(override: AppPluginMetas): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setAppPluginMetas() function can only be called from tests.');
  }

  setApps(structuredClone(override));
}
