import { DataSourceSettings, PluginType, PluginInclude, NavModel, NavModelItem } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

export function buildNavModel(dataSource: DataSourceSettings, plugin: GenericDataSourcePlugin): NavModelItem {
  const pluginMeta = plugin.meta;

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

  if (pluginMeta.includes && hasDashboards(pluginMeta.includes)) {
    navModel.children!.push({
      active: false,
      icon: 'apps',
      id: `datasource-dashboards-${dataSource.uid}`,
      text: 'Dashboards',
      url: `datasources/edit/${dataSource.uid}/dashboards`,
    });
  }

  if (featureEnabled('dspermissions')) {
    if (contextSrv.hasPermission(AccessControlAction.DataSourcesPermissionsRead)) {
      navModel.children!.push({
        active: false,
        icon: 'lock',
        id: `datasource-permissions-${dataSource.id}`,
        text: 'Permissions',
        url: `datasources/edit/${dataSource.id}/permissions`,
      });
    }
  }

  if (featureEnabled('analytics')) {
    navModel.children!.push({
      active: false,
      icon: 'info-circle',
      id: `datasource-insights-${dataSource.id}`,
      text: 'Insights',
      url: `datasources/edit/${dataSource.id}/insights`,
    });
  }

  if (featureEnabled('caching')) {
    navModel.children!.push({
      active: false,
      icon: 'database',
      id: `datasource-cache-${dataSource.uid}`,
      text: 'Cache',
      url: `datasources/edit/${dataSource.uid}/cache`,
      hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
    });
  }

  return navModel;
}

export function getDataSourceNav(main: NavModelItem, pageName: string): NavModel {
  let node: NavModelItem;

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
      type: 'Loading',
      typeName: 'Loading',
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
