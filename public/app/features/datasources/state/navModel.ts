import { DataSourceSettings, PluginType, PluginInclude, NavModel, NavModelItem } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

const loadingDSType = 'Loading';

export function buildNavModel(dataSource: DataSourceSettings, plugin: GenericDataSourcePlugin): NavModelItem {
  const pluginMeta = plugin.meta;
  const highlightsEnabled = config.featureToggles.featureHighlights;
  const navModel: NavModelItem = {
    img: pluginMeta.info.logos.large,
    id: 'datasource-' + dataSource.uid,
    subTitle: `Type: ${pluginMeta.name}`,
    url: '',
    text: dataSource.name,
    breadcrumbs: [{ title: 'Data Sources', url: 'datasources' }],
    children: [
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `datasource-settings-${dataSource.uid}`,
        text: 'Settings',
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
      text: 'Dashboards',
      url: `datasources/edit/${dataSource.uid}/dashboards`,
    });
  }

  const isLoadingNav = dataSource.type === loadingDSType;

  const dsPermissions = {
    active: false,
    icon: 'lock',
    id: `datasource-permissions-${dataSource.uid}`,
    text: 'Permissions',
    url: `datasources/edit/${dataSource.uid}/permissions`,
  };

  if (featureEnabled('dspermissions')) {
    if (contextSrv.hasPermission(AccessControlAction.DataSourcesPermissionsRead)) {
      navModel.children!.push(dsPermissions);
    }
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...dsPermissions,
      url: dsPermissions.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: 'feature-highlights-data-source-permissions-badge' }),
    });
  }

  const analytics = {
    active: false,
    icon: 'info-circle',
    id: `datasource-insights-${dataSource.id}`,
    text: 'Insights',
    url: `datasources/edit/${dataSource.id}/insights`,
  };

  if (featureEnabled('analytics')) {
    navModel.children!.push(analytics);
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...analytics,
      url: analytics.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: 'feature-highlights-data-source-insights-badge' }),
    });
  }

  const caching = {
    active: false,
    icon: 'database',
    id: `datasource-cache-${dataSource.uid}`,
    text: 'Cache',
    url: `datasources/edit/${dataSource.uid}/cache`,
    hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
  };

  if (featureEnabled('caching')) {
    navModel.children!.push(caching);
  } else if (highlightsEnabled && !isLoadingNav) {
    navModel.children!.push({
      ...caching,
      url: caching.url + '/upgrade',
      tabSuffix: () => ProBadge({ experimentId: 'feature-highlights-data-source-caching-badge' }),
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
      basicAuthPassword: '',
      withCredentials: false,
      database: '',
      id: 1,
      uid: 'x',
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: 'Loading',
      orgId: 1,
      password: '',
      readOnly: false,
      type: loadingDSType,
      typeName: loadingDSType,
      typeLogoUrl: 'public/img/icn-datasource.svg',
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
