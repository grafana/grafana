import { useAsync } from 'react-use';

import { getAppPluginMeta, getAppPluginMetas, getAppPluginVersion, isAppPluginInstalled } from './apps';
import { getListedPanelPluginIds, getPanelPluginMeta, getPanelPluginMetas } from './panels';

export function useAppPluginMetas() {
  const { loading, error, value } = useAsync(async () => getAppPluginMetas());
  return { loading, error, value };
}

export function useAppPluginMeta(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginMeta(pluginId));
  return { loading, error, value };
}

export function usePanelPluginMetas() {
  const { loading, error, value } = useAsync(async () => getPanelPluginMetas());
  return { loading, error, value };
}

export function usePanelPluginMeta(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getPanelPluginMeta(pluginId));
  return { loading, error, value };
}

/**
 * Hook that checks if an app plugin is installed. The hook does not check if the app plugin is enabled.
 * @param pluginId - The ID of the app plugin.
 * @returns loading, error, value of the app plugin installed status.
 * The value is true if the app plugin is installed, false otherwise.
 */
export function useAppPluginInstalled(pluginId: string) {
  const { loading, error, value } = useAsync(async () => isAppPluginInstalled(pluginId));
  return { loading, error, value };
}

/**
 * Hook that gets the version of an app plugin.
 * @param pluginId - The ID of the app plugin.
 * @returns loading, error, value of the app plugin version.
 * The value is the version of the app plugin, or null if the plugin is not installed.
 */
export function useAppPluginVersion(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginVersion(pluginId));
  return { loading, error, value };
}

/**
 * Hook that returns a list of panel plugin ids that are not hidden from list.
 * @returns loading, error, value of the list of panel plugin ids that are not hidden from list.
 */
export function useListedPanelPluginIds() {
  const { loading, error, value } = useAsync(async () => getListedPanelPluginIds());
  return { loading, error, value };
}
