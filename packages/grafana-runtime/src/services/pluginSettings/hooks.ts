import { useAsync } from 'react-use';

import { type PluginMeta } from '@grafana/data';

import { getPluginSettings } from './getPluginSettings';
import { getAppPluginEnabled, getAppPluginEnabledState } from './settings';
import { isNotFoundError } from './utils';

/**
 * Hook that checks if an app plugin is installed and enabled.
 * @param pluginId - The ID of the app plugin.
 * @returns loading, error, value of the app plugin installed and enabled status.
 * The value is true if the app plugin is installed and enabled, false otherwise.
 */
export function useAppPluginEnabled(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginEnabled(pluginId), [pluginId]);
  return { loading, error, value };
}

/**
 * Hook variant of {@link getAppPluginEnabledState} that distinguishes a definitive answer
 * (`enabled` / `not-an-enabled-app`) from an indeterminate one (`unknown`, e.g. a failed request).
 * @param pluginId - The ID of the app plugin.
 * @returns loading, error and the resolved `AppPluginEnabledState` (undefined while loading).
 */
export function useAppPluginEnabledState(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginEnabledState(pluginId), [pluginId]);
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
      // A 404 means the plugin is simply not installed — treat it as a normal absence, not an error.
      if (isNotFoundError(err)) {
        return undefined;
      }
      throw err;
    }
  }, [pluginId]);
  return { loading, error, value };
}
