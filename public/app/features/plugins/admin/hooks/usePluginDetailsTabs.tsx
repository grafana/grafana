import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaPlugin, NavModelItem, PluginIncludeType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { usePluginConfig } from '../hooks/usePluginConfig';
import { CatalogPlugin, PluginTabIds, PluginTabLabels } from '../types';

type ReturnType = {
  error: Error | undefined;
  loading: boolean;
  navModel: NavModelItem;
  activePageId: PluginTabIds | string;
};

function getCurrentPageId(
  pageId: PluginTabIds | undefined,
  isNarrowScreen: boolean | undefined,
  defaultTab: string
): PluginTabIds | string {
  if (!isNarrowScreen && pageId === PluginTabIds.PLUGINDETAILS) {
    return defaultTab;
  }
  return pageId || defaultTab;
}

export const usePluginDetailsTabs = (
  plugin?: CatalogPlugin,
  pageId?: PluginTabIds,
  isNarrowScreen?: boolean
): ReturnType => {
  const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
  const { pathname } = useLocation();
  const defaultTab = useDefaultPage(plugin, pluginConfig);
  const isPublished = Boolean(plugin?.isPublished);

  const currentPageId = getCurrentPageId(pageId, isNarrowScreen, defaultTab);

  const navModelChildren = useMemo(() => {
    const canConfigurePlugins = plugin && contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);
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
    if (isPublished && plugin?.details?.changelog) {
      navModelChildren.push({
        text: PluginTabLabels.CHANGELOG,
        id: PluginTabIds.CHANGELOG,
        icon: 'rocket',
        url: `${pathname}?page=${PluginTabIds.CHANGELOG}`,
        active: PluginTabIds.CHANGELOG === currentPageId,
      });
    }

    if (isPublished && isNarrowScreen && config.featureToggles.pluginsDetailsRightPanel) {
      navModelChildren.push({
        text: PluginTabLabels.PLUGINDETAILS,
        id: PluginTabIds.PLUGINDETAILS,
        icon: 'info-circle',
        url: `${pathname}?page=${PluginTabIds.PLUGINDETAILS}`,
        active: PluginTabIds.PLUGINDETAILS === currentPageId,
      });
    }

    // Not extending the tabs with the config pages if the plugin is not installed
    if (!pluginConfig) {
      return navModelChildren;
    }

    if (config.featureToggles.externalServiceAccounts && (plugin?.iam || plugin?.details?.iam)) {
      navModelChildren.push({
        text: PluginTabLabels.IAM,
        icon: 'shield',
        id: PluginTabIds.IAM,
        url: `${pathname}?page=${PluginTabIds.IAM}`,
        active: PluginTabIds.IAM === currentPageId,
      });
    }

    if (
      config.featureToggles.panelTitleSearch &&
      (pluginConfig.meta.type === PluginType.panel || pluginConfig.meta.type === PluginType.datasource)
    ) {
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
  }, [plugin, pluginConfig, pathname, isPublished, currentPageId, isNarrowScreen]);

  const navModel: NavModelItem = {
    text: plugin?.name ?? '',
    img: plugin?.info.logos.small,
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

  const hasAccess = contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);

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
