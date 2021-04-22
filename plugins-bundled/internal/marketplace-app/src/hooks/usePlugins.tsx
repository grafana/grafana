import { useEffect, useState } from 'react';

import { Plugin, Metadata } from '../types';
import API from '../api';

type PluginsState = {
  status: 'DONE' | 'LOADING';
  items: Plugin[];
  installedPlugins: any[];
};

export const usePlugins = ({
  pluginDir,
  includeUnsigned,
  includeEnterprise,
}: {
  pluginDir?: string;
  includeUnsigned?: boolean;
  includeEnterprise?: boolean;
}) => {
  const [state, setState] = useState<PluginsState>({ status: 'LOADING', items: [], installedPlugins: [] });

  useEffect(() => {
    setState((state) => ({ ...state, status: 'LOADING' }));

    (async () => {
      const api = new API(pluginDir);
      const items = await api.getRemotePlugins();
      const filteredItems = items
        .filter((plugin) => plugin.versionSignatureType || includeUnsigned)
        .filter((plugin) => includeEnterprise || plugin.status !== 'enterprise')
        .filter((plugin) => !status || plugin.status === status);

      if (pluginDir) {
        const installedRes = await api.getInstalledPlugins();
        setState((state) => ({ ...state, items: filteredItems, installedPlugins: installedRes, status: 'DONE' }));
      } else {
        setState((state) => ({ ...state, items: filteredItems, status: 'DONE' }));
      }
    })();
  }, [includeEnterprise, includeUnsigned, pluginDir]);

  return state;
};

type PluginState = {
  status: 'DONE' | 'LOADING';
  remote?: Plugin;
  remoteVersions?: Array<{ version: string; createdAt: string }>;
  local?: Metadata;
};

export const usePlugin = ({ slug, pluginDir }: { slug: string; pluginDir?: string }): PluginState => {
  const [state, setState] = useState<PluginState>({
    status: 'LOADING',
  });

  useEffect(() => {
    setState((state) => ({ ...state, status: 'LOADING' }));

    (async () => {
      const api = new API(pluginDir);
      const plugin = await api.getPlugin(slug);
      setState({ ...plugin, status: 'DONE' });
    })();
  }, [slug, pluginDir]);

  return state;
};
