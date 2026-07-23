import { type AppPluginConfig, type AppPluginMetaConfig, PluginType } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromise } from '../../utils/getCachedPromise';

import { FALLBACK_TO_BOOTDATA_ERROR_WARNING, FALLBACK_TO_BOOTDATA_WARNING } from './constants';
import { logPluginMetaDebug, logPluginMetaWarning } from './logging';
import { getAppPluginMapper } from './mappers/mappers';
import { fetchPluginMetas, getPluginMetasUrl, initPluginMetas } from './plugins';
import type { AppPluginMetas, PluginMetasResponse } from './types';

let apps: AppPluginMetas = {};

function initialized(): boolean {
  return Boolean(Object.keys(apps).length);
}

function setApps(input: AppPluginMetas) {
  apps = input;
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

/** Uncached fetch + map used by {@link getAppPluginMetasStrict}; rejects on fetch failure. */
async function loadAppPluginMetasStrict(): Promise<AppPluginMetaConfig[]> {
  const metas = await fetchPluginMetas();
  const mapper = getAppPluginMapper();
  return Object.values(mapper(metas));
}

/**
 * Fetches the app plugin configs from the plugin metas API without the
 * bootdata fallback: unlike {@link getAppPluginMetas}, a failed metas fetch
 * rejects instead of resolving to an empty list (the cache entry is
 * invalidated on failure, so a later call retries). With the
 * plugins.useMTPlugins flag off it resolves to an empty array. The result is
 * cached, so concurrent callers share one fetch and one resolved array — note
 * the cache has no refetch hook: a successful response is reused for the rest
 * of the session, and installing or uninstalling a plugin does not
 * invalidate it.
 */
export function getAppPluginMetasStrict(): Promise<AppPluginMetaConfig[]> {
  return getCachedPromise(loadAppPluginMetasStrict);
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
