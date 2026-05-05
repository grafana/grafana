import { type PluginMeta } from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromiseWithArgs } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';

import { getSettingsMapper } from './mappers/mappers';
import { type Settings as v0alpha1Settings } from './types';
import { getApiVersion, getCacheKey, getLegacyCacheKey, getNamespace, isAuthError } from './utils';

export function getLegacySettings(pluginId: string, showErrorAlert?: boolean): Promise<PluginMeta> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(new Error('Unknown Plugin', { cause: err }));
    });
}

export function getAppPluginSettings(pluginId: string, showErrorAlert?: boolean): Promise<v0alpha1Settings> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get<v0alpha1Settings>(
      `/apis/${pluginId}.grafana.app/${getApiVersion()}/namespaces/${getNamespace()}/settings/${pluginId}`,
      undefined,
      undefined,
      options
    )
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(new Error('Unknown Plugin', { cause: err }));
    });
}

/**
 * Get the settings for a plugin, returning a cached promise when available.
 * @param pluginId - The id of the plugin.
 * @param showErrorAlert - Whether to show a UI error alert if the request fails.
 * @returns The plugin's `PluginMeta`.
 * @throws If there is no installed plugin that matches `pluginId`.
 */
export async function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta) {
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  if (meta.spec.pluginJson.type !== 'app') {
    const mapper = getSettingsMapper();
    return mapper(meta.spec);
  }

  const settings = await getCachedAppSettings(pluginId, showErrorAlert);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

const getCachedLegacySettings = getCachedPromiseWithArgs(getLegacySettings, {
  cacheKeyFn: getLegacyCacheKey,
});

const getCachedAppSettings = getCachedPromiseWithArgs(getAppPluginSettings, {
  cacheKeyFn: getCacheKey,
});
