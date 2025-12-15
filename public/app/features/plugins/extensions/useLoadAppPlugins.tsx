import { useAsync } from 'react-use';

import { PreloadAppPluginsPredicate, preloadPluginsWithPredicate } from '../pluginPreloader';

export function useLoadAppPlugins(extensionId: string, predicate: PreloadAppPluginsPredicate): { isLoading: boolean } {
  const { loading: isLoading } = useAsync(
    () => preloadPluginsWithPredicate(extensionId, predicate),
    [extensionId, predicate]
  );

  return { isLoading: isLoading };
}
