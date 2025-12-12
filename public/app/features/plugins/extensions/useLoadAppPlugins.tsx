import { useAsync } from 'react-use';

import { AppPluginConfig } from '@grafana/data';
import { useAppPluginMetas } from '@grafana/runtime/unstable';

import { preloadPlugins } from '../pluginPreloader';

export type UseLoadAppPluginsPredicate = (apps: AppPluginConfig[], filterById: string) => string[];

const noop: UseLoadAppPluginsPredicate = () => [];

export function useLoadAppPlugins(
  filterById: string,
  predicate: UseLoadAppPluginsPredicate = noop
): { isLoading: boolean } {
  const { isAppPluginMetasLoading, apps } = useAppPluginMetas();
  const { isAppPluginMetasLoading: isFilteredLoading, apps: filtered } = useAppPluginMetas(predicate(apps, filterById));
  const { loading: isLoading } = useAsync(async () => {
    if (!filtered.length) {
      return;
    }

    await preloadPlugins(filtered);
  }, [filtered]);

  return { isLoading: isLoading || isAppPluginMetasLoading || isFilteredLoading };
}
