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
  const {
    name,
    slug: id,
    description,
    version,
    orgName,
    popularity,
    downloads,
    updatedAt,
    createdAt: publishedAt,
  } = plugin;
  const catalogPlugin = {
    description,
    downloads,
    id,
    info: {
      logos: {
        small: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/small`,
        large: `https://grafana.com/api/plugins/${id}/versions/${version}/logos/large`,
      },
    },
    name,
    orgName,
    popularity,
    publishedAt,
    updatedAt,
    version,
    isInstalled: false,
  };
  return catalogPlugin;
}

function mapLocalToCatalog(plugin: LocalPlugin): CatalogPlugin {
  const {
    name,
    info: { description, version, logos, updated, author },
    id,
  } = plugin;
  return {
    description,
    downloads: 0,
    id,
    info: { logos },
    name,
    orgName: author.name,
    popularity: 0,
    publishedAt: '',
    updatedAt: updated,
    version,
    isInstalled: true,
  };
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
  error: Error | undefined;
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

function applySearchFilter(searchBy: string | undefined, plugins: CatalogPlugin[]): CatalogPlugin[] {
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
