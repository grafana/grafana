import { useAsync } from 'react-use';

import { preloadPlugins } from '../pluginPreloader';

import { getAppPluginConfigs } from './utils';

export function useLoadAppPlugins(pluginIds: string[] = []): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(async () => {
    const appConfigs = getAppPluginConfigs(pluginIds);

    if (!appConfigs.length) {
      return;
    }

    await preloadPlugins(appConfigs);
  });

  return { isLoading };
}
