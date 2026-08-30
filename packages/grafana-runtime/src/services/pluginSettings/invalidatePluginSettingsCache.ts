import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromise } from '../../utils/getCachedPromise';

import { getLegacyCacheKey, getCacheKey } from './utils';

/**
 * Invalidate the cached plugin settings for a plugin so the next call to
 * `getPluginSettings` re-fetches from the backend. Silently no-ops when no
 * cache entry exists for the given plugin id.
 * @param pluginId - The id of the plugin.
 */
export function invalidatePluginSettingsCache(pluginId: string): void {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    invalidateCachedPromise(getLegacyCacheKey(pluginId));
    return;
  }

  invalidateCachedPromise(getCacheKey(pluginId));
}
