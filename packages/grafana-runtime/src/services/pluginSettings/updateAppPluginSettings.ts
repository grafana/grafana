import { compare, type Operation } from 'fast-json-patch';

import { type PluginMeta } from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { replaceCachedPromise } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { refetchPluginMeta } from '../pluginMeta/plugins';

import { logPluginSettingsDebug, logPluginSettingsError } from './logging';
import { getSettingsMapper } from './mappers/mappers';
import { inlineSecureValuesMapper, settingsSpecMapper } from './mappers/v0alpha1SettingsMapper';
import { refetchCachedAppSettings, refetchCachedLegacySettings } from './refetchPluginSettings';
import { type Settings as v0alpha1Settings } from './types';
import { getApiVersion, getCacheKey, getNamespace } from './utils';

function updateLegacySettings(pluginId: string, data: Partial<PluginMeta>): Promise<void> {
  logPluginSettingsDebug('PluginSettings: updating legacy plugin settings', { pluginId });
  return getBackendSrv()
    .post<void>(`/api/plugins/${pluginId}/settings`, data, { validatePath: true })
    .catch((err) => {
      logPluginSettingsError('PluginSettings: updating legacy plugin settings failed', err, { pluginId });
      return Promise.reject(err);
    });
}

async function internalUpdateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<v0alpha1Settings> {
  const spec = settingsSpecMapper(data);
  const secure = inlineSecureValuesMapper(data);
  const update = {
    apiVersion: `${pluginId}/${getApiVersion()}`,
    kind: 'Settings',
    spec,
    secure,
  };

  const { metadata, ...stored } = await refetchCachedAppSettings(pluginId, false);
  const test: Operation = { op: 'test', path: '/metadata/resourceVersion', value: metadata.resourceVersion };
  const patch = [test, ...compare(stored, update)];
  logPluginSettingsDebug('PluginSettings: updating plugin settings', { pluginId });

  const updated = await getBackendSrv()
    .patch<v0alpha1Settings>(`/apis/${pluginId}/${getApiVersion()}/namespaces/${getNamespace()}/app/instance`, patch, {
      validatePath: true,
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    })
    .catch((err) => {
      logPluginSettingsError('PluginSettings: updating plugin settings failed', err, { pluginId });
      return Promise.reject(err);
    });

  return updated;
}

/**
 * Update the settings for an app plugin.
 * @param pluginId - The id of the plugin.
 * @param data - The partial `PluginMeta` to apply to the stored settings.
 * @returns The updated plugin's `PluginMeta`.
 */
export async function updateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<PluginMeta> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    await updateLegacySettings(pluginId, data);
    return refetchCachedLegacySettings(pluginId, false);
  }

  const meta = await refetchPluginMeta(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginSettings: falling back to updating legacy plugin settings', { pluginId });
    await updateLegacySettings(pluginId, data);
    return refetchCachedLegacySettings(pluginId, false);
  }

  if (meta.spec.pluginJson.type !== 'app') {
    const mapper = getSettingsMapper();
    return mapper(meta.spec);
  }

  const updatedSettings = await internalUpdateAppPluginSettings(pluginId, data);
  const cacheKey = getCacheKey(pluginId);
  replaceCachedPromise(cacheKey, updatedSettings); // add updated settings to cache
  const mapper = getSettingsMapper();
  return mapper(meta.spec, updatedSettings);
}
