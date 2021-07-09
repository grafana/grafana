import { useEffect, useMemo, useState } from 'react';

import { Plugin, LocalPlugin } from '../types';
import { api } from '../api';

type PluginsState = {
  isLoading: boolean;
  items: Plugin[];
  installedPlugins: any[];
};

export const usePlugins = () => {
  const [state, setState] = useState<PluginsState>({ isLoading: true, items: [], installedPlugins: [] });

  useEffect(() => {
    const fetchPluginData = async () => {
      const items = await api.getRemotePlugins();
      const filteredPlugins = items.filter((plugin) => {
        const isNotRenderer = plugin.typeCode !== 'renderer';
        const isSigned = Boolean(plugin.versionSignatureType);
        const isNotEnterprise = plugin.status !== 'enterprise';

        return isNotRenderer && isSigned && isNotEnterprise;
      });

      const installedPlugins = await api.getInstalledPlugins();

      setState((state) => ({ ...state, items: filteredPlugins, installedPlugins, isLoading: false }));
    };

    fetchPluginData();
  }, []);

  return state;
};

type FilteredPluginsState = {
  isLoading: boolean;
  items: Plugin[];
};

export const usePluginsByFilter = (searchBy: string, filterBy: string): FilteredPluginsState => {
  const plugins = usePlugins();
  const all = useMemo(() => {
    const combined: Plugin[] = [];
    Array.prototype.push.apply(combined, plugins.items);
    Array.prototype.push.apply(combined, plugins.installedPlugins);

    const bySlug = combined.reduce((unique: Record<string, Plugin>, plugin) => {
      unique[plugin.slug] = plugin;
      return unique;
    }, {});

    return Object.values(bySlug);
  }, [plugins.items, plugins.installedPlugins]);

  if (filterBy === 'installed') {
    return {
      isLoading: plugins.isLoading,
      items: applySearchFilter(searchBy, plugins.installedPlugins ?? []),
    };
  }

  return {
    isLoading: plugins.isLoading,
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
  const [state, setState] = useState<PluginState>({
    isLoading: true,
  });

  useEffect(() => {
    const fetchPluginData = async () => {
      const plugin = await api.getPlugin(slug);
      setState({ ...plugin, isLoading: false });
    };
    fetchPluginData();
  }, [slug]);

  return state;
};
