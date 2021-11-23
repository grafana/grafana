import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PluginIncludeType, PluginType } from '@grafana/data';
import { CatalogPlugin, PluginDetailsTab, PluginTabIds, PluginTabLabels } from '../types';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { isOrgAdmin } from '../permissions';

type ReturnType = {
  error: Error | undefined;
  loading: boolean;
  tabs: PluginDetailsTab[];
  defaultTab: string;
};

export const usePluginDetailsTabs = (plugin?: CatalogPlugin, defaultTabs: PluginDetailsTab[] = []): ReturnType => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const isPublished = Boolean(plugin?.isPublished);
  const { pathname } = useLocation();

  const [tabs, defaultTab] = useMemo(() => {
    const canConfigurePlugins = isOrgAdmin();
    const tabs: PluginDetailsTab[] = [...defaultTabs];
    let defaultTab;

    if (isPublished) {
      tabs.push({
        label: PluginTabLabels.VERSIONS,
        icon: 'history',
        id: PluginTabIds.VERSIONS,
        href: `${pathname}?page=${PluginTabIds.VERSIONS}`,
      });
    }

    // Not extending the tabs with the config pages if the plugin is not installed
    if (!pluginConfig) {
      defaultTab = PluginTabIds.OVERVIEW;
      return [tabs, defaultTab];
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
          defaultTab = PluginTabIds.CONFIG;
        }

        if (pluginConfig.configPages) {
          for (const page of pluginConfig.configPages) {
            tabs.push({
              label: page.title,
              icon: page.icon,
              id: page.id,
              href: `${pathname}?page=${page.id}`,
            });
            if (!defaultTab) {
              defaultTab = page.id;
            }
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

    if (!defaultTab) {
      defaultTab = PluginTabIds.OVERVIEW;
    }

    return [tabs, defaultTab];
  }, [pluginConfig, defaultTabs, pathname, isPublished]);

  return {
    error,
    loading,
    tabs,
    defaultTab,
  };
};
