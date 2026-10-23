import { type AppPluginConfig, PluginType } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';

import { FALLBACK_TO_BOOTDATA_ERROR_WARNING, FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import { logPluginMetaDebug, logPluginMetaError, logPluginMetaWarning } from './logging';
import { getAppPluginMapper } from './mappers/mappers';
import { getPluginMetasUrl, initPluginMetas } from './plugins';
import type { AppPluginMetas, PluginMetasResponse } from './types';

let apps: AppPluginMetas = {};
// Tracked separately from whether `apps` holds anything: an instance with no app
// plugins is a legitimately empty cache.
let didInit = false;

function initialized(): boolean {
  return didInit;
}

function setApps(input: AppPluginMetas) {
  apps = input;
  didInit = true;
}

function setMetas(metas: PluginMetasResponse | null) {
  if (!metas?.items.length) {
    // null means plugin meta failed to load, empty items means the API had nothing
    const message = metas ? FALLBACK_TO_BOOTDATA_WARNING : FALLBACK_TO_BOOTDATA_ERROR_WARNING;
    // eslint-disable-next-line @grafana/no-config-apps
    setApps(config.apps);
    logPluginMetaWarning(message, { pluginType: PluginType.app, requestUrl: getPluginMetasUrl() });
    return;
  }

  const mapper = getAppPluginMapper();
  setApps(mapper(metas));
  logPluginMetaDebug('PluginMeta: initializing app plugins cache with meta values', {});
}

async function initAppPluginMetas(): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    // eslint-disable-next-line @grafana/no-config-apps
    setApps(config.apps);
    logPluginMetaDebug('PluginMeta: initializing app plugins cache with bootdata values', {});
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

/**
 * Get the installed app plugins.
 * This is a synchronous function that should only be used as an escape hatch in cases where the caller is guaranteed to be called after the app plugins have been initialized.
 * In other cases, getAppPluginMetas() should be used instead to ensure the app plugins have been initialized before accessing them.
 * Logs and returns what it has when the cache was never filled, like getPanelPluginMetasMapSync.
 * @returns the installed app plugins
 */
export function getAppPluginMetasSync(): AppPluginConfig[] {
  if (!initialized()) {
    logPluginMetaError(
      'PluginMeta: getAppPluginMetasSync() was called before the app plugins cache was initialized',
      new Error('App plugin metas not initialized')
    );
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

/** Empties the cache, so the next read fetches again. Tests only. */
export function clearAppPluginMetas(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearAppPluginMetas() function can only be called from tests.');
  }

  apps = {};
  didInit = false;
}
