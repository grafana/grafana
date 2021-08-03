import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { CatalogPlugin, CatalogPluginsState, PluginsByFilterType, FilteredPluginsState } from '../types';
import { api } from '../api';
import { mapLocalToCatalog, mapRemoteToCatalog, isInstalled, isType, matchesKeyword } from '../helpers';

export function usePlugins(): CatalogPluginsState {
  const { loading, value, error } = useAsync(async () => {
    const remote = await api.getRemotePlugins();
    const installed = await api.getInstalledPlugins();
    return { remote, installed };
  }, []);

  const plugins = useMemo(() => {
    const installed = value?.installed || [];
    const remote = value?.remote || [];
    const unique: Record<string, CatalogPlugin> = {};

    for (const plugin of installed) {
      unique[plugin.id] = mapLocalToCatalog(plugin);
    }

    for (const plugin of remote) {
      if (unique[plugin.slug]) {
        continue;
      }

      if (plugin.typeCode === 'renderer') {
        continue;
      }

      if (!Boolean(plugin.versionSignatureType)) {
        continue;
      }

      unique[plugin.slug] = mapRemoteToCatalog(plugin);
    }

    return Object.values(unique);
  }, [value?.installed, value?.remote]);

  return {
    loading,
    error,
    plugins,
  };
}

const URLFilterHandlers = {
  filterBy: isInstalled,
  filterByType: isType,
  searchBy: matchesKeyword,
};

export const usePluginsByFilter = (queries: PluginsByFilterType): FilteredPluginsState => {
  const { loading, error, plugins } = usePlugins();

  const filteredPlugins = plugins.filter((plugin) =>
    Object.keys(queries).every((query: keyof PluginsByFilterType) =>
      typeof URLFilterHandlers[query] === 'function' ? URLFilterHandlers[query](plugin, queries[query]) : true
    )
  );

  return {
    isLoading: loading,
    error,
    plugins: filteredPlugins,
  };
};
