import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { CatalogPlugin } from '../types';
import { api } from '../api';
import { mapLocalToCatalog, mapRemoteToCatalog } from '../helpers';

type CatalogPluginsState = {
  loading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

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

type FilteredPluginsState = {
  isLoading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

type PluginsByFilterType = {
  searchBy: string;
  filterBy: string;
  filterByType: string;
};

const filters = {
  filterBy: (plugin: CatalogPlugin, filterBy?: string) =>
    filterBy === 'installed' ? plugin.isInstalled : !plugin.isCore,

  filterByType: (plugin: CatalogPlugin, filterByType?: string) =>
    filterByType === 'all' || plugin.type === filterByType,

  searchBy: (plugin: CatalogPlugin, searchBy?: string) => {
    if (!searchBy) {
      return true;
    }
    const fields: String[] = [];
    if (plugin.name) {
      fields.push(plugin.name.toLowerCase());
    }

    if (plugin.orgName) {
      fields.push(plugin.orgName.toLowerCase());
    }

    return fields.some((f) => f.includes(searchBy.toLowerCase()));
  },
};

export const usePluginsByFilter = (queries: PluginsByFilterType): FilteredPluginsState => {
  const { loading, error, plugins } = usePlugins();

  const filteredPlugins = plugins.filter((plugin) =>
    Object.keys(queries).every((query: keyof PluginsByFilterType) => {
      return typeof filters[query] === 'function' ? filters[query](plugin, queries[query]) : true;
    })
  );

  return {
    isLoading: loading,
    error,
    plugins: filteredPlugins,
  };
};
