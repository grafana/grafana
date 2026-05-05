import { useAsync } from 'react-use';

import { getAppPluginEnabled } from './settings';

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
