import { invalidateCachedPromise } from '../../utils/getCachedPromise';
import { getLegacyCacheKey, getCacheKey, SUPPORTED_APP_PLUGIN_API_VERSIONS } from '../pluginUtils';

/**
 * Invalidate the cached plugin settings for a plugin so the next call to
 * `getPluginSettings` re-fetches from the backend. Silently no-ops when no
 * cache entry exists for the given plugin id.
 * @param pluginId - The id of the plugin.
 */
export function invalidatePluginSettingsCache(pluginId: string): void {
  // The MT path also falls back to the legacy cache, so drop every key the settings may sit under.
  invalidateCachedPromise(getLegacyCacheKey(pluginId));
  for (const apiVersion of SUPPORTED_APP_PLUGIN_API_VERSIONS) {
    invalidateCachedPromise(getCacheKey(pluginId, apiVersion));
  }
}
