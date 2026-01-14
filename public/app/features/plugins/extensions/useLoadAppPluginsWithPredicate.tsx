import { useAsync } from 'react-use';

import { AppPluginConfig } from '@grafana/data';
import { config } from '@grafana/runtime';
import { evaluateBooleanFlag, getAppPluginMetas } from '@grafana/runtime/internal';

import { useLoadAppPlugins } from './useLoadAppPlugins';

type LoadAppPluginsWithPredidcate = (pluginId: string, apps?: AppPluginConfig[]) => string[];

export function useLoadAppPluginsWithPredicate(
  pluginId: string,
  predicate: LoadAppPluginsWithPredidcate
): { isLoading: boolean } {
  const { loading: isLoadingAppPluginMetas, value: apps } = useAsync(async () => {
    if (!evaluateBooleanFlag('useMTAppsLoading', false)) {
      // this will go away as soon as the useMTAppsLoading feature is rolled out 100% to prod
      // eslint-disable-next-line no-restricted-syntax
      return Object.values(config.apps);
    }

    return getAppPluginMetas();
  });
  const { isLoading } = useLoadAppPlugins(predicate(pluginId, apps));

  return { isLoading: isLoadingAppPluginMetas || isLoading };
}
