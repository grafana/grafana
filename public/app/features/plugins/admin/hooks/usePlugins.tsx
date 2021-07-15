import { useMemo } from 'react';
import { useAsync } from 'react-use';
import { Plugin, LocalPlugin } from '../types';
import { api } from '../api';

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
