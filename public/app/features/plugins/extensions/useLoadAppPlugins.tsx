import { useAsync } from 'react-use';

import { loadDependentAppPlugins, type PluginDependencyPredicate } from './loadDependentAppPlugins';

export function useLoadAppPlugins(pluginId: string, predicate: PluginDependencyPredicate): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(async () => {
    await loadDependentAppPlugins(pluginId, predicate);
  }, [pluginId, predicate]);

  return { isLoading };
}
