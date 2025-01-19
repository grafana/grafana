import { useAsync } from 'react-use';

import { preloadPlugins } from '../pluginPreloader';

import { getPluginConfigs } from './utils';

export function useLoadPlugins(pluginIds: string[] = []): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(async () => {
    const pluginConfigs = getPluginConfigs(pluginIds);

    if (!pluginConfigs.length) {
      return;
    }

    await preloadPlugins(pluginConfigs);
  });

  return { isLoading };
}
