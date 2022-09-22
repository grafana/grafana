import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaPlugin, PluginIncludeType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { usePluginConfig } from '../hooks/usePluginConfig';
import { isOrgAdmin } from '../permissions';
import { CatalogPlugin, PluginDetailsTab, PluginTabIds, PluginTabLabels } from '../types';

type ReturnType = {
  error: Error | undefined;
  loading: boolean;
  tabs: PluginDetailsTab[];
  defaultTab: string;
};

export const usePluginDetailsTabs = (plugin?: CatalogPlugin, defaultTabs: PluginDetailsTab[] = []): ReturnType => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const { pathname } = useLocation();
  const defaultTab = useDefaultPage(plugin, pluginConfig);

  const isPublished = Boolean(plugin?.isPublished);

  const tabs = useMemo(() => {
    const canConfigurePlugins =
      plugin && contextSrv.hasAccessInMetadata(AccessControlAction.PluginsWrite, plugin, isOrgAdmin());
    const tabs: PluginDetailsTab[] = [...defaultTabs];

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
      return tabs;
    }

    if (config.featureToggles.panelTitleSearch && pluginConfig.meta.type === PluginType.panel) {
      tabs.push({
        label: PluginTabLabels.USAGE,
        icon: 'list-ul',
        id: PluginTabIds.USAGE,
        href: `${pathname}?page=${PluginTabIds.USAGE}`,
      });
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
  }, [plugin, pluginConfig, defaultTabs, pathname, isPublished]);

  return {
    error,
    loading,
    tabs,
    defaultTab,
  };
};

function useDefaultPage(plugin: CatalogPlugin | undefined, pluginConfig: GrafanaPlugin | undefined | null) {
  if (!plugin || !pluginConfig) {
    return PluginTabIds.OVERVIEW;
  }

  const hasAccess = contextSrv.hasAccessInMetadata(AccessControlAction.PluginsWrite, plugin, isOrgAdmin());

  if (!hasAccess || pluginConfig.meta.type !== PluginType.app) {
    return PluginTabIds.OVERVIEW;
  }

  if (pluginConfig.angularConfigCtrl) {
    return PluginTabIds.CONFIG;
  }

  if (pluginConfig.configPages?.length) {
    return pluginConfig.configPages[0].id;
  }

  return PluginTabIds.OVERVIEW;
}
