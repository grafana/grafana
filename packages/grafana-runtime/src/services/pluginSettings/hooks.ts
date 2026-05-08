import { useAsync } from 'react-use';

import { type PluginMeta } from '@grafana/data';

import { isFetchError } from '../backendSrv';

import { getPluginSettings } from './getPluginSettings';
import { getAppPluginEnabled } from './settings';

/**
 * Hook that checks if an app plugin is installed and enabled.
 * @param pluginId - The ID of the app plugin.
 * @returns loading, error, value of the app plugin installed and enabled status.
 * The value is true if the app plugin is installed and enabled, false otherwise.
 */
export function useAppPluginEnabled(pluginId: string) {
  const { loading, error, value } = useAsync(async () => {
    if (!pluginId) {
      return false;
    }
    return getAppPluginEnabled(pluginId);
  }, [pluginId]);
  return { loading, error, value };
}

/**
 * Hook that fetches the full plugin settings (PluginMeta) for a given plugin ID.
 * @param pluginId - The ID of the plugin.
 * @returns loading, error, value where value is the PluginMeta or undefined if not found.
 * A 404 (plugin not installed) resolves to value: undefined with no error.
 * Other failures (auth errors, server errors) are surfaced via the error field.
 */
export function usePluginSettings(pluginId: string) {
  const { loading, error, value } = useAsync(async (): Promise<PluginMeta | undefined> => {
    if (!pluginId) {
      return undefined;
    }
    try {
      return await getPluginSettings(pluginId);
    } catch (err) {
      // getLegacySettings wraps the raw fetch error as the `cause`. A 404 means the
      // plugin is simply not installed — treat it as a normal absence, not an error.
      const cause = err instanceof Error ? err.cause : err;
      if (isFetchError(cause) && cause.status === 404) {
        return undefined;
      }
      throw err;
    }
  }, [pluginId]);
  return { loading, error, value };
}
