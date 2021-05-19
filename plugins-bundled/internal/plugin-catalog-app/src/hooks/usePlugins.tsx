import { useEffect, useState } from 'react';

import { Plugin, Metadata } from '../types';
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
      const filteredItems = items
        .filter((plugin) => Boolean(plugin.versionSignatureType))
        .filter((plugin) => plugin.status !== 'enterprise')
        .filter((plugin) => !status || plugin.status === status);
      const installedPlugins = await api.getInstalledPlugins();

      setState((state) => ({ ...state, items: filteredItems, installedPlugins, isLoading: false }));
    };

    fetchPluginData();
  }, []);

  return state;
};

type PluginState = {
  isLoading: boolean;
  remote?: Plugin;
  remoteVersions?: Array<{ version: string; createdAt: string }>;
  local?: Metadata;
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
