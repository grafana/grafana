import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PluginIncludeType, PluginType } from '@grafana/data';
import { CatalogPlugin, PluginDetailsTab, PluginTabIds } from '../types';
import { isOrgAdmin } from '../helpers';
import { usePluginConfig } from '../hooks/usePluginConfig';

type ReturnType = {
  error: Error | undefined;
  loading: boolean;
  tabs: PluginDetailsTab[];
};

export const usePluginDetailsTabs = (plugin?: CatalogPlugin, defaultTabs: PluginDetailsTab[] = []): ReturnType => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const { pathname } = useLocation();
  const tabs = useMemo(() => {
    const canConfigurePlugins = isOrgAdmin();
    const tabs: PluginDetailsTab[] = [...defaultTabs];

    // Not extending the tabs with the config pages if the plugin is not installed
    if (!pluginConfig) {
      return tabs;
    }

    if (canConfigurePlugins) {
      if (pluginConfig.meta.type === PluginType.app) {
        if (pluginConfig.angularConfigCtrl) {
          tabs.push({
            label: 'Config',
            icon: 'cog',
            id: PluginTabIds.CONFIG,
            href: `${pathname}?page=${PluginTabIds.CONFIG}`,
          });
        }

        if (pluginConfig.configPages) {
          for (const page of pluginConfig.configPages) {
            tabs.push({
              label: page.title,
              icon: page.icon,
              id: page.id,
              href: `${pathname}?page=${page.id}`,
            });
          }
        }

        if (pluginConfig.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
          tabs.push({
            label: 'Dashboards',
            icon: 'apps',
            id: PluginTabIds.DASHBOARDS,
            href: `${pathname}?page=${PluginTabIds.DASHBOARDS}`,
          });
        }
      }
    }

    return tabs;
  }, [pluginConfig, defaultTabs, pathname]);

  return {
    error,
    loading,
    tabs,
  };
};
