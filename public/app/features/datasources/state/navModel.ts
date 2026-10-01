import {
  type DataSourceSettings,
  PluginType,
  type PluginInclude,
  type NavModel,
  type NavModelItem,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { OrangeBadge } from 'app/core/components/Branding/OrangeBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';
import { AccessControlAction } from 'app/types/accessControl';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { type GenericDataSourcePlugin } from '../types';

const loadingDSType = 'Loading';

export function buildNavModel(dataSource: DataSourceSettings, plugin: GenericDataSourcePlugin): NavModelItem {
  const pluginMeta = plugin.meta;
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

  // OSS and unlicensed builds show every Pro tab with a badge; licensed builds show a tab
  // only when the license includes the feature and the user may read it.
  const showProTabs = isOpenSourceBuildOrUnlicenced();
  const addProTab = (tab: NavModelItem, canUse: boolean) => {
    if (showProTabs) {
      navModel.children!.push({ ...tab, tabSuffix: OrangeBadge });
    } else if (canUse) {
      navModel.children!.push(tab);
    }
  };

  addProTab(
    {
      active: false,
      icon: 'lock',
      id: `datasource-permissions-${dataSource.uid}`,
      text: t('datasources.build-nav-model.ds-permissions.text.permissions', 'Permissions'),
      url: `datasources/edit/${dataSource.uid}/permissions`,
    },
    featureEnabled('dspermissions.enforcement') &&
      contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesPermissionsRead, dataSource)
  );

  addProTab(
    {
      active: false,
      icon: 'info-circle',
      id: `datasource-insights-${dataSource.uid}`,
      text: t('datasources.build-nav-model.analytics.text.insights', 'Insights'),
      url: `datasources/edit/${dataSource.uid}/insights`,
    },
    Boolean(config.analytics?.enabled) &&
      featureEnabled('analytics') &&
      contextSrv.hasPermission(AccessControlAction.DataSourcesInsightsRead)
  );

  addProTab(
    {
      active: false,
      icon: 'database',
      id: `datasource-cache-${dataSource.uid}`,
      text: t('datasources.build-nav-model.caching.text.cache', 'Cache'),
      url: `datasources/edit/${dataSource.uid}/cache`,
      hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
    },
    featureEnabled('caching') &&
      contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesCachingRead, dataSource)
  );

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
