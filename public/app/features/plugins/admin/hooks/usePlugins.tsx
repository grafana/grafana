import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { Plugin, LocalPlugin, CatalogPlugin, CatalogPluginDetails } from '../types';
import { api } from '../api';
import { mapLocalToCatalog, mapRemoteToCatalog, applySearchFilter } from '../helpers';

type CatalogPluginsState = {
  loading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

export function useCatalogPlugins(): CatalogPluginsState {
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
  const { loading, error, plugins } = useCatalogPlugins();

  const [installed, all] = useMemo(
    () =>
      plugins.reduce<[CatalogPlugin[], CatalogPlugin[]]>(
        (result, plugin) => {
          result[plugin.isInstalled ? 0 : 1].push(plugin);
          return result;
        },
        [[], []]
      ),
    [plugins]
  );

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
    plugins: applySearchFilter(searchBy, all),
  };
};

type PluginState = {
  isLoading: boolean;
  remote?: Plugin;
  remoteVersions?: Array<{ version: string; createdAt: string }>;
  local?: LocalPlugin;
};

export const usePlugin = (slug: string): PluginState => {
  const { loading, value } = useAsync(async () => {
    return await api.getPlugin(slug);
  }, [slug]);

  return {
    isLoading: loading,
    ...value,
  };
};

type CatalogPluginState = {
  isLoading: boolean;
  plugin?: CatalogPluginDetails;
};

export const useCatalogPlugin = (id: string): CatalogPluginState => {
  const { loading, value } = useAsync(async () => {
    return await api.getCatalogPlugin(id);
  }, [id]);

  return {
    isLoading: loading,
    plugin: value,
  };
};
