import { DataSourceSettings, PluginType, PluginInclude, NavModel, NavModelItem } from '@grafana/data';
import config from 'app/core/config';
import { GenericDataSourcePlugin } from '../settings/PluginSettings';

export function buildNavModel(dataSource: DataSourceSettings, plugin: GenericDataSourcePlugin): NavModelItem {
  const pluginMeta = plugin.meta;

  const navModel = {
    img: pluginMeta.info.logos.large,
    id: 'datasource-' + dataSource.id,
    subTitle: `Type: ${pluginMeta.name}`,
    url: '',
    text: dataSource.name,
    breadcrumbs: [{ title: 'Data Sources', url: 'datasources' }],
    children: [
      {
        active: false,
        icon: 'sliders-v-alt',
        id: `datasource-settings-${dataSource.id}`,
        text: 'Settings',
        url: `datasources/edit/${dataSource.id}/`,
      },
    ],
  };

  if (plugin.configPages) {
    for (const page of plugin.configPages) {
      navModel.children.push({
        active: false,
        text: page.title,
        icon: page.icon,
        url: `datasources/edit/${dataSource.id}/?page=${page.id}`,
        id: `datasource-page-${page.id}`,
      });
    }
  }

  if (pluginMeta.includes && hasDashboards(pluginMeta.includes)) {
    navModel.children.push({
      active: false,
      icon: 'apps',
      id: `datasource-dashboards-${dataSource.id}`,
      text: 'Dashboards',
      url: `datasources/edit/${dataSource.id}/dashboards`,
    });
  }

  if (config.licenseInfo.hasLicense) {
    navModel.children.push({
      active: false,
      icon: 'lock',
      id: `datasource-permissions-${dataSource.id}`,
      text: 'Permissions',
      url: `datasources/edit/${dataSource.id}/permissions`,
    });
  }

  return navModel;
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
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: 'Loading',
      orgId: 1,
      password: '',
      readOnly: false,
      type: 'Loading',
      typeLogoUrl: 'public/img/icn-datasource.svg',
      url: '',
      user: '',
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
    } as GenericDataSourcePlugin
  );

  let node: NavModelItem;

  // find active page
  for (const child of main.children) {
    if (child.id.indexOf(pageName) > 0) {
      child.active = true;
      node = child;
      break;
    }
  }

  return {
    main: main,
    node: node,
  };
}

function hasDashboards(includes: PluginInclude[]): boolean {
  return (
    includes.find(include => {
      return include.type === 'dashboard';
    }) !== undefined
  );
}
