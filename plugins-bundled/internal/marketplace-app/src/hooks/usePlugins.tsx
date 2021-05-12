import { useEffect, useState } from 'react';

import { Plugin, Metadata } from '../types';
import { api } from '../api';

type PluginsState = {
  status: 'DONE' | 'LOADING';
  items: Plugin[];
  installedPlugins: any[];
};

export const usePlugins = (includeEnterprise = false) => {
  const [state, setState] = useState<PluginsState>({ status: 'LOADING', items: [], installedPlugins: [] });

  useEffect(() => {
    const fetchPluginData = async () => {
      const items = await api.getRemotePlugins();
      const filteredItems = items
        .filter((plugin) => Boolean(plugin.versionSignatureType))
        .filter((plugin) => includeEnterprise || plugin.status !== 'enterprise')
        .filter((plugin) => !status || plugin.status === status);
      const installedPlugins = await api.getInstalledPlugins();

      setState((state) => ({ ...state, items: filteredItems, installedPlugins, status: 'DONE' }));
    };

    fetchPluginData();
  }, [includeEnterprise]);

  return state;
};

type PluginState = {
  status: 'DONE' | 'LOADING';
  remote?: Plugin;
  remoteVersions?: Array<{ version: string; createdAt: string }>;
  local?: Metadata;
};

export const usePlugin = (slug: string): PluginState => {
  const [state, setState] = useState<PluginState>({
    status: 'LOADING',
  });

  useEffect(() => {
    const fetchPluginData = async () => {
      const plugin = await api.getPlugin(slug);
      setState({ ...plugin, status: 'DONE' });
    };
    fetchPluginData();
  }, [slug]);

  return state;
};
