import { type PluginMeta } from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromiseWithArgs } from '../../utils/getCachedPromise';
import { refetchPluginMeta } from '../pluginMeta/plugins';

import { getAppPluginSettings, getLegacySettings } from './getPluginSettings';
import { getSettingsMapper } from './mappers/mappers';
import { getCacheKey, getLegacyCacheKey } from './utils';

export async function refetchPluginSettings(pluginId: string): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
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

  const settings = await refetchCachedAppSettings(pluginId, false);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

export const refetchCachedLegacySettings = getCachedPromiseWithArgs(getLegacySettings, {
  invalidate: true,
  cacheKeyFn: getLegacyCacheKey,
});

export const refetchCachedAppSettings = getCachedPromiseWithArgs(getAppPluginSettings, {
  invalidate: true,
  cacheKeyFn: getCacheKey,
});
