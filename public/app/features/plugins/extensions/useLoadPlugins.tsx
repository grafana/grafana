import { useAsync } from 'react-use';

import { preloadPlugins } from '../pluginPreloader';

import { getPluginConfigs } from './utils';

export function useLoadPlugins(pluginIds: string[] = []): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(async () => {
    const appConfigs = getPluginConfigs(pluginIds);

    if (!appConfigs.length) {
      return;
    }

    await preloadPlugins(appConfigs);
  });

  return { isLoading };
}
