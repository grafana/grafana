import { useAsync } from 'react-use';

import { getAppPluginMeta, getAppPluginMetas, getAppPluginVersion, isAppPluginInstalled } from './apps';

export function useAppPluginMetas() {
  const { loading, error, value } = useAsync(async () => getAppPluginMetas());
  return { appPluginMetasLoading: loading, appPluginMetasError: error, appPluginMetas: value };
}

export function useAppPluginMeta(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginMeta(pluginId));
  return { appPluginMetaLoading: loading, appPluginMetaError: error, appPluginMeta: value };
}

export function useAppPluginInstalled(pluginId: string) {
  const { loading, error, value } = useAsync(async () => isAppPluginInstalled(pluginId));
  return { appPluginInstalledLoading: loading, appPluginInstalledError: error, appPluginInstalled: value };
}

export function useAppPluginVersion(pluginId: string) {
  const { loading, error, value } = useAsync(async () => getAppPluginVersion(pluginId));
  return { appPluginVersionLoading: loading, appPluginVersionError: error, appPluginVersion: value };
}
