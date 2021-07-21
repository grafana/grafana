import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { CatalogPlugin, CatalogPluginDetails } from '../types';
import { api } from '../api';
import { mapLocalToCatalog, mapRemoteToCatalog, getCatalogPluginDetails, applySearchFilter } from '../helpers';

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

export const usePluginsByFilter = (searchBy: string, filterBy: string): FilteredPluginsState => {
  const { loading, error, plugins } = usePlugins();

  const installed = useMemo(() => plugins.filter((plugin) => plugin.isInstalled), [plugins]);

  if (filterBy === 'installed') {
    return {
      isLoading: loading,
      error,
      plugins: applySearchFilter(searchBy, installed),
    };
  }

  return {
    isLoading: loading,
    error,
    plugins: applySearchFilter(searchBy, plugins),
  };
};

type PluginState = {
  isLoading: boolean;
  plugin?: CatalogPluginDetails;
};

export const usePlugin = (slug: string): PluginState => {
  const { loading, value } = useAsync(async () => {
    return await api.getPlugin(slug);
  }, [slug]);

  const plugin = getCatalogPluginDetails(value?.local, value?.remote, value?.remoteVersions);

  return {
    isLoading: loading,
    plugin,
  };
};
