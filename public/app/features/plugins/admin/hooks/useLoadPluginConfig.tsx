import { useMemo } from 'react';
import { PluginType, PluginIncludeType } from '@grafana/data';
import { useAsync } from 'react-use';
import { contextSrv } from '../../../../core/services/context_srv';
import { loadPlugin } from '../../PluginPage';

const defaultTabs = [{ label: 'Overview' }, { label: 'Version history' }];

export const useLoadPluginConfig = (pluginId: string, isInstalled: boolean) => {
  const { loading, value: plugin, error } = useAsync(async () => {
    let plugin;
    if (isInstalled) {
      plugin = await loadPlugin(pluginId);
    }
    return plugin;
  }, [pluginId, isInstalled]);

  const tabs = useMemo(() => {
    const isAdmin = contextSrv.hasRole('Admin');
    const tabs: Array<{ label: string }> = [...defaultTabs];

    if (!plugin) {
      return tabs;
    }

    if (isAdmin) {
      if (plugin.meta.type === PluginType.app) {
        if (plugin.angularConfigCtrl) {
          tabs.push({
            label: 'Config',
          });
        }

        if (plugin.configPages) {
          for (const page of plugin.configPages) {
            tabs.push({
              label: page.title,
            });
          }
        }

        if (plugin.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
          tabs.push({
            label: 'Dashboards',
          });
        }
      }
    }

    return tabs;
  }, [plugin]);

  return {
    loading,
    pluginConfig: plugin,
    tabs,
    error,
  };
};
