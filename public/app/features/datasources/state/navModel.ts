import { DataSourceSettings, PluginType, PluginInclude, NavModel, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';
import { highlightTrial } from 'app/features/admin/utils';
import { AccessControlAction } from 'app/types/accessControl';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { GenericDataSourcePlugin } from '../types';

const loadingDSType = 'Loading';

export function buildNavModel(dataSource: DataSourceSettings, plugin: GenericDataSourcePlugin): NavModelItem {
  const pluginMeta = plugin.meta;
  const highlightsEnabled = config.featureToggles.featureHighlights;
  const navModel: NavModelItem = {
    img: pluginMeta.info.logos.large,
    id: 'datasource-' + dataSource.uid,
    url: '',
    text: dataSource.name,
    children: [
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `datasource-settings-${dataSource.uid}`,
        text: t('datasources.build-nav-model.nav-model.text.settings', 'Settings'),
        url: `datasources/edit/${dataSource.uid}/`,
      },
    ],
  };

  if (plugin.configPages) {
    for (const page of plugin.configPages) {
      navModel.children!.push({
        active: false,
        text: page.title,
        icon: page.icon,
        url: `datasources/edit/${dataSource.uid}/?page=${page.id}`,
        id: `datasource-page-${page.id}`,
      });
    }
  }

  if (pluginMeta.includes && hasDashboards(pluginMeta.includes) && contextSrv.hasRole('Admin')) {
    navModel.children!.push({
      active: false,
      icon: 'apps',
      id: `datasource-dashboards-${dataSource.uid}`,
      text: t('datasources.build-nav-model.text.dashboards', 'Dashboards'),
      url: `datasources/edit/${dataSource.uid}/dashboards`,
    });
  }

  const shouldEnableFeatureHighlights = isOpenSourceBuildOrUnlicenced();

  const isLoadingNav = dataSource.type === loadingDSType;

  const permissionsExperimentId = 'feature-highlights-data-source-permissions-badge';
  const dsPermissions: NavModelItem = {
    active: false,
    icon: 'lock',
    id: `datasource-permissions-${dataSource.uid}`,
    text: t('datasources.build-nav-model.ds-permissions.text.permissions', 'Permissions'),
    url: `datasources/edit/${dataSource.uid}/permissions`,
  };



  if (highlightTrial() && !isLoadingNav || shouldEnableFeatureHighlights) {
    dsPermissions.tabSuffix = () => ProBadge({ experimentId: permissionsExperimentId, eventVariant: 'trial' });
  }

  if (featureEnabled('dspermissions.enforcement') || shouldEnableFeatureHighlights) {
    if (contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesPermissionsRead, dataSource) || shouldEnableFeatureHighlights) {
      navModel.children!.push(dsPermissions);
    }
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...dsPermissions,
      url: dsPermissions.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: permissionsExperimentId }),
    });
  }

  if (config.analytics?.enabled || shouldEnableFeatureHighlights) {
    const analyticsExperimentId = 'feature-highlights-data-source-insights-badge';
    const analytics: NavModelItem = {
      active: false,
      icon: 'info-circle',
      id: `datasource-insights-${dataSource.uid}`,
      text: t('datasources.build-nav-model.analytics.text.insights', 'Insights'),
      url: `datasources/edit/${dataSource.uid}/insights`,
    };

    if (highlightTrial() && !isLoadingNav || shouldEnableFeatureHighlights) {
      analytics.tabSuffix = () => ProBadge({ experimentId: analyticsExperimentId, eventVariant: 'trial' });
    }

    if (featureEnabled('analytics') || shouldEnableFeatureHighlights) {
      if (contextSrv.hasPermission(AccessControlAction.DataSourcesInsightsRead) || shouldEnableFeatureHighlights) {
        navModel.children!.push(analytics);
      }
    } else if (highlightsEnabled && !isLoadingNav) {
      navModel.children!.push({
        ...analytics,
        url: analytics.url + '/upgrade',
        tabSuffix: () => ProBadge({ experimentId: analyticsExperimentId }),
      });
    }
  }

  const cachingExperimentId = 'feature-highlights-query-caching-badge';

  const caching: NavModelItem = {
    active: false,
    icon: 'database',
    id: `datasource-cache-${dataSource.uid}`,
    text: t('datasources.build-nav-model.caching.text.cache', 'Cache'),
    url: `datasources/edit/${dataSource.uid}/cache`,
    hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
  };

  if (highlightTrial() && !isLoadingNav || shouldEnableFeatureHighlights) {
    caching.tabSuffix = () => ProBadge({ experimentId: cachingExperimentId, eventVariant: 'trial' });
  }

  if (featureEnabled('caching') || shouldEnableFeatureHighlights) {
    if (contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesCachingRead, dataSource) || shouldEnableFeatureHighlights) {
      navModel.children!.push(caching);
    }
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...caching,
      url: caching.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: cachingExperimentId }),
    });
  }

  return navModel;
}

export function getDataSourceNav(main: NavModelItem, pageName: string): NavModel {
  let node: NavModelItem = { text: '' };

  // find active page
  for (const child of main.children!) {
    if (child.id!.indexOf(pageName) > 0) {
      child.active = true;
      node = child;
      break;
    }
  }

  return {
    main: main,
    node: node!,
  };
}
export function getDataSourceLoadingNav(pageName: string): NavModel {
  const main = buildNavModel(
    {
      access: '',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      database: '',
      id: 1,
      uid: 'x',
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: 'Loading',
      orgId: 1,
      readOnly: false,
      type: loadingDSType,
      typeName: loadingDSType,
      typeLogoUrl: icnDatasourceSvg,
      url: '',
      user: '',
      secureJsonFields: {},
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    {
      meta: {
        id: '1',
        type: PluginType.datasource,
        name: '',
        info: {
          author: {
            name: '',
            url: '',
          },
          description: '',
          links: [{ name: '', url: '' }],
          logos: {
            large: '',
            small: '',
          },
          screenshots: [],
          updated: '',
          version: '',
        },
        includes: [],
        module: '',
        baseUrl: '',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );

  return getDataSourceNav(main, pageName);
}

function hasDashboards(includes: PluginInclude[]): boolean {
  return (
    includes.find((include) => {
      return include.type === 'dashboard';
    }) !== undefined
  );
}
