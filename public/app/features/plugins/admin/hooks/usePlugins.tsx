import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { Plugin, LocalPlugin, CatalogPlugin } from '../types';
import { api } from '../api';

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

function mapRemoteToCatalog(plugin: Plugin): CatalogPlugin {
  return {} as CatalogPlugin;
}

function mapLocalToCatalog(plugin: LocalPlugin): CatalogPlugin {
  return {} as CatalogPlugin;
}

export const usePlugins = () => {
  const result = useAsync(async () => {
    const items = await api.getRemotePlugins();
    const filteredPlugins = items.filter((plugin) => {
      const isNotRenderer = plugin.typeCode !== 'renderer';
      const isSigned = Boolean(plugin.versionSignatureType);

      return isNotRenderer && isSigned;
    });

    const installedPlugins = await api.getInstalledPlugins();

    return { items: filteredPlugins, installedPlugins };
  }, []);

  return result;
};

type FilteredPluginsState = {
  isLoading: boolean;
  items: Array<Plugin | LocalPlugin>;
};

export const usePluginsByFilter = (searchBy: string, filterBy: string): FilteredPluginsState => {
  const { loading, value } = usePlugins();
  const all = useMemo(() => {
    const combined: Plugin[] = [];
    Array.prototype.push.apply(combined, value?.items ?? []);
    Array.prototype.push.apply(combined, value?.installedPlugins ?? []);

    const bySlug = combined.reduce((unique: Record<string, Plugin>, plugin) => {
      unique[plugin.slug] = plugin;
      return unique;
    }, {});

    return Object.values(bySlug);
  }, [value?.items, value?.installedPlugins]);

  if (filterBy === 'installed') {
    return {
      isLoading: loading,
      items: applySearchFilter(searchBy, value?.installedPlugins ?? []),
    };
  }

  return {
    isLoading: loading,
    items: applySearchFilter(searchBy, all),
  };
};

function applySearchFilter(searchBy: string | undefined, plugins: Plugin[]): Plugin[] {
  if (!searchBy) {
    return plugins;
  }

  return plugins.filter((plugin) => {
    const fields: String[] = [];

    if (plugin.name) {
      fields.push(plugin.name.toLowerCase());
    }

    if (plugin.orgName) {
      fields.push(plugin.orgName.toLowerCase());
    }

    return fields.some((f) => f.includes(searchBy.toLowerCase()));
  });
}

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
