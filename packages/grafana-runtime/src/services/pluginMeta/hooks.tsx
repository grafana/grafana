import { useAsync } from 'react-use';

import { getAppPluginVersion, isAppPluginInstalled } from './apps';

export function useAppPluginInstalled(pluginId: string) {
  const { loading, error, value } = useAsync(async () => isAppPluginInstalled(pluginId));
  return { appPluginInstalledLoading: loading, appPluginInstalledError: error, appPluginInstalled: value };
}

export function useAppPluginVersion(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginVersion(pluginId));
  return { appPluginVersionLoading: loading, appPluginVersionError: error, appPluginVersion: value };
}
