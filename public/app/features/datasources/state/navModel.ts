import { DataSourceSettings, PluginType, PluginInclude, NavModel, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
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

  const test = true;

  console.log({ test })

  const isLoadingNav = dataSource.type === loadingDSType;

  // TODO I want this
  const permissionsExperimentId = 'feature-highlights-data-source-permissions-badge';
  const dsPermissions: NavModelItem = {
    active: false,
    icon: 'lock',
    id: `datasource-permissions-${dataSource.uid}`,
    text: t('datasources.build-nav-model.ds-permissions.text.permissions', 'Permissions'),
    url: `datasources/edit/${dataSource.uid}/permissions`,
  };



  if (highlightTrial() && !isLoadingNav || test) {
    dsPermissions.tabSuffix = () => ProBadge({ experimentId: permissionsExperimentId, eventVariant: 'trial' });
  }

  if (featureEnabled('dspermissions.enforcement') || test) {
    if (contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesPermissionsRead, dataSource) || test) {
      navModel.children!.push(dsPermissions);
    }
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...dsPermissions,
      url: dsPermissions.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: permissionsExperimentId }),
    });
  }

  if (config.analytics?.enabled || test) {
    // TODO I want this
    const analyticsExperimentId = 'feature-highlights-data-source-insights-badge';
    const analytics: NavModelItem = {
      active: false,
      icon: 'info-circle',
      id: `datasource-insights-${dataSource.uid}`,
      text: t('datasources.build-nav-model.analytics.text.insights', 'Insights'),
      url: `datasources/edit/${dataSource.uid}/insights`,
    };

    if (highlightTrial() && !isLoadingNav || test) {
      analytics.tabSuffix = () => ProBadge({ experimentId: analyticsExperimentId, eventVariant: 'trial' });
    }

    if (featureEnabled('analytics') || test) {
      if (contextSrv.hasPermission(AccessControlAction.DataSourcesInsightsRead) || test) {
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

  // TODO I want this
  const cachingExperimentId = 'feature-highlights-query-caching-badge';

  const caching: NavModelItem = {
    active: false,
    icon: 'database',
    id: `datasource-cache-${dataSource.uid}`,
    text: t('datasources.build-nav-model.caching.text.cache', 'Cache'),
    url: `datasources/edit/${dataSource.uid}/cache`,
    hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
  };

  if (highlightTrial() && !isLoadingNav || test) {
    caching.tabSuffix = () => ProBadge({ experimentId: cachingExperimentId, eventVariant: 'trial' });
  }

  if (featureEnabled('caching') || test) {
    if (contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesCachingRead, dataSource) || test) {
      navModel.children!.push(caching);
    }
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...caching,
      url: caching.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: cachingExperimentId }),
    });
  }

  console.log('navModel.children.length', navModel.children?.length);

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
