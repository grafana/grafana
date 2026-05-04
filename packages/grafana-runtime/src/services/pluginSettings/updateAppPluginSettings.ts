import { compare, type Operation } from 'fast-json-patch';

import { type PluginMeta } from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { replaceCachedPromise } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { refetchPluginMeta } from '../pluginMeta/plugins';

import { getSettingsMapper } from './mappers/mappers';
import { inlineSecureValuesMapper, settingsSpecMapper } from './mappers/v0alpha1SettingsMapper';
import { refetchCachedAppSettings, refetchCachedLegacySettings } from './refetchPluginSettings';
import { getApiVersion, getCacheKey, getNamespace } from './settings';
import { type Settings as v0alpha1Settings } from './types';

function updateLegacySettings(id: string, data: Partial<PluginMeta>): Promise<void> {
  return getBackendSrv().post<void>(`/api/plugins/${id}/settings`, data, { validatePath: true });
}

async function internalUpdateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<v0alpha1Settings> {
  const spec = settingsSpecMapper(data);
  const secure = inlineSecureValuesMapper(data);
  const update = {
    apiVersion: `${pluginId}.grafana.app/${getApiVersion()}`,
    kind: 'Settings',
    spec,
    secure,
  };

  const { metadata, ...stored } = await refetchCachedAppSettings(pluginId, false);
  const test: Operation = { op: 'test', path: '/metadata/resourceVersion', value: metadata.resourceVersion };
  const patch = [test, ...compare(stored, update)];

  const updated = await getBackendSrv().patch<v0alpha1Settings>(
    `/apis/${pluginId}.grafana.app/${getApiVersion()}/namespaces/${getNamespace()}/settings/${pluginId}`,
    patch,
    {
      validatePath: true,
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );

  return updated;
}

/**
 * Update the settings for an app plugin.
 * @param pluginId - The id of the plugin.
 * @param data - The partial `PluginMeta` to apply to the stored settings.
 * @returns The updated plugin's `PluginMeta`, or `null` if no settings are available.
 * @throws If there is no installed plugin that matches `pluginId`.
 */
export async function updateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
    await updateLegacySettings(pluginId, data);
    return refetchCachedLegacySettings(pluginId, false);
  }

  const meta = await refetchPluginMeta(pluginId);
  if (!meta) {
    throw new Error(`Plugin not found, no installed plugin with id ${pluginId}`);
  }

  if (meta.spec.pluginJson.type !== 'app') {
    const mapper = getSettingsMapper();
    return mapper(meta.spec);
  }

  const updatedSettings = await internalUpdateAppPluginSettings(pluginId, data);
  replaceCachedPromise(() => internalUpdateAppPluginSettings(pluginId, data), updatedSettings, {
    cacheKey: getCacheKey(pluginId),
  });
  const mapper = getSettingsMapper();
  return mapper(meta.spec, updatedSettings);
}
