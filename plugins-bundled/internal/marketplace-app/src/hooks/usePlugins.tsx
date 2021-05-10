import { useEffect, useState } from 'react';

import { Plugin, Metadata } from '../types';
import API from '../api';

type PluginsState = {
  status: 'DONE' | 'LOADING';
  items: Plugin[];
  installedPlugins: any[];
};

export const usePlugins = ({
  includeUnsigned,
  includeEnterprise,
}: {
  includeUnsigned?: boolean;
  includeEnterprise?: boolean;
}) => {
  const [state, setState] = useState<PluginsState>({ status: 'LOADING', items: [], installedPlugins: [] });

  useEffect(() => {
    setState((state) => ({ ...state, status: 'LOADING' }));

    (async () => {
      const api = new API();
      const items = await api.getRemotePlugins();
      const filteredItems = items
        .filter((plugin) => plugin.versionSignatureType || includeUnsigned)
        .filter((plugin) => includeEnterprise || plugin.status !== 'enterprise')
        .filter((plugin) => !status || plugin.status === status);
      const installedPlugins = await api.getInstalledPlugins();

      setState((state) => ({ ...state, items: filteredItems, installedPlugins, status: 'DONE' }));
    })();
  }, [includeEnterprise, includeUnsigned]);

  return state;
};

type PluginState = {
  status: 'DONE' | 'LOADING';
  remote?: Plugin;
  remoteVersions?: Array<{ version: string; createdAt: string }>;
  local?: Metadata;
};

export const usePlugin = ({ slug }: { slug: string }): PluginState => {
  const [state, setState] = useState<PluginState>({
    status: 'LOADING',
  });

  useEffect(() => {
    setState((state) => ({ ...state, status: 'LOADING' }));

    (async () => {
      const api = new API();
      const plugin = await api.getPlugin(slug);
      setState({ ...plugin, status: 'DONE' });
    })();
  }, [slug]);

  return state;
};
