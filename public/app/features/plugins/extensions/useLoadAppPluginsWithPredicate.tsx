import { useAsync } from 'react-use';

import { useLoadAppPlugins } from './useLoadAppPlugins';

type Predicate = (pluginId: string) => Promise<string[]>;

export function useLoadAppPluginsWithPredicate(pluginId: string, predicate: Predicate): { isLoading: boolean } {
  const { loading: isPredicateLoading, value: pluginIds } = useAsync(() => predicate(pluginId), [pluginId, predicate]);
  const { isLoading } = useLoadAppPlugins(pluginIds);

  return { isLoading: isPredicateLoading || isLoading };
}
