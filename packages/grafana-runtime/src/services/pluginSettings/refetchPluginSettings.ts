import { type PluginMeta } from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromiseWithArgs } from '../../utils/getCachedPromise';
import { refetchPluginMeta } from '../pluginMeta/plugins';
import { assertPluginIdFormat, getLegacyCacheKey, resolveAppPluginAPIVersion } from '../pluginUtils';

import { getAppPluginSettings, getAppSettingsCacheKey, getLegacySettings } from './getPluginSettings';
import { logPluginSettingsDebug } from './logging';
import { getSettingsMapper } from './mappers/mappers';

export async function refetchPluginSettings(pluginId: string): Promise<PluginMeta> {
  assertPluginIdFormat(pluginId);

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    return refetchCachedLegacySettings(pluginId, false);
  }

  const meta = await refetchPluginMeta(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginSettings: falling back to refetching legacy plugin settings', { pluginId });
    return refetchCachedLegacySettings(pluginId, false);
  }

  if (meta.spec.pluginJson.type !== 'app') {
    const mapper = getSettingsMapper();
    return mapper(meta.spec);
  }

  const apiVersion = await resolveAppPluginAPIVersion(pluginId);
  if (!apiVersion) {
    logPluginSettingsDebug('PluginSettings: API not served, falling back to refetching legacy plugin settings', {
      pluginId,
    });
    return refetchCachedLegacySettings(pluginId, false);
  }

  const settings = await refetchCachedAppSettings(pluginId, false, apiVersion);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

export const refetchCachedLegacySettings = getCachedPromiseWithArgs(getLegacySettings, {
  invalidate: true,
  cacheKeyFn: getLegacyCacheKey,
});

export const refetchCachedAppSettings = getCachedPromiseWithArgs(getAppPluginSettings, {
  invalidate: true,
  cacheKeyFn: getAppSettingsCacheKey,
});
