import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaPlugin, NavModelItem, PluginIncludeType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { usePluginConfig } from '../hooks/usePluginConfig';
import { isOrgAdmin } from '../permissions';
import { CatalogPlugin, PluginTabIds, PluginTabLabels } from '../types';

type ReturnType = {
  error: Error | undefined;
  loading: boolean;
  navModel: NavModelItem;
  activePageId: PluginTabIds | string;
};

export const usePluginDetailsTabs = (plugin?: CatalogPlugin, pageId?: PluginTabIds): ReturnType => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const { pathname } = useLocation();
  const defaultTab = useDefaultPage(plugin, pluginConfig);
  const parentUrl = pathname.substring(0, pathname.lastIndexOf('/'));
  const isPublished = Boolean(plugin?.isPublished);

  const currentPageId = pageId || defaultTab;
  const navModelChildren = useMemo(() => {
    const canConfigurePlugins =
      plugin && contextSrv.hasAccessInMetadata(AccessControlAction.PluginsWrite, plugin, isOrgAdmin());
    const navModelChildren: NavModelItem[] = [];
    if (isPublished) {
      navModelChildren.push({
        text: PluginTabLabels.VERSIONS,
        id: PluginTabIds.VERSIONS,
        icon: 'history',
        url: `${pathname}?page=${PluginTabIds.VERSIONS}`,
        active: PluginTabIds.VERSIONS === currentPageId,
      });
    }

    // Not extending the tabs with the config pages if the plugin is not installed
    if (!pluginConfig) {
      return navModelChildren;
    }

    if (config.featureToggles.panelTitleSearch && pluginConfig.meta.type === PluginType.panel) {
      navModelChildren.push({
        text: PluginTabLabels.USAGE,
        icon: 'list-ul',
        id: PluginTabIds.USAGE,
        url: `${pathname}?page=${PluginTabIds.USAGE}`,
        active: PluginTabIds.USAGE === currentPageId,
      });
    }

    if (!canConfigurePlugins) {
      return navModelChildren;
    }

    if (pluginConfig.meta.type === PluginType.app) {
      if (pluginConfig.angularConfigCtrl) {
        navModelChildren.push({
          text: 'Config',
          icon: 'cog',
          id: PluginTabIds.CONFIG,
          url: `${pathname}?page=${PluginTabIds.CONFIG}`,
          active: PluginTabIds.CONFIG === currentPageId,
        });
      }

      if (pluginConfig.configPages) {
        for (const configPage of pluginConfig.configPages) {
          navModelChildren.push({
            text: configPage.title,
            icon: configPage.icon,
            id: configPage.id,
            url: `${pathname}?page=${configPage.id}`,
            active: configPage.id === currentPageId,
          });
        }
      }

      if (pluginConfig.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
        navModelChildren.push({
          text: 'Dashboards',
          icon: 'apps',
          id: PluginTabIds.DASHBOARDS,
          url: `${pathname}?page=${PluginTabIds.DASHBOARDS}`,
          active: PluginTabIds.DASHBOARDS === currentPageId,
        });
      }
    }

    return navModelChildren;
  }, [plugin, pluginConfig, pathname, isPublished, currentPageId]);

  const navModel: NavModelItem = {
    text: plugin?.name ?? '',
    img: plugin?.info.logos.small,
    breadcrumbs: [{ title: 'Plugins', url: parentUrl }],
    children: [
      {
        text: PluginTabLabels.OVERVIEW,
        icon: 'file-alt',
        id: PluginTabIds.OVERVIEW,
        url: `${pathname}?page=${PluginTabIds.OVERVIEW}`,
        active: PluginTabIds.OVERVIEW === currentPageId,
      },
      ...navModelChildren,
    ],
  };

  return {
    error,
    loading,
    navModel,
    activePageId: currentPageId,
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
