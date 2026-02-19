import { useAsync } from 'react-use';

import { preloadPlugins } from '../pluginPreloader';

import { getAppPluginConfigs } from './utils';

type Predicate = (pluginId: string) => Promise<string[]>;

export function useLoadAppPlugins(pluginId: string, predicate: Predicate): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(async () => {
    const filteredConfigs = await predicate(pluginId);

    if (!filteredConfigs.length) {
      return;
    }

    const appConfigs = await getAppPluginConfigs(filteredConfigs);

    if (!appConfigs.length) {
      return;
    }

    await preloadPlugins(appConfigs);
  }, [pluginId, predicate]);

  return { isLoading };
}
