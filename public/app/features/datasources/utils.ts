import {
  type DataSourceJsonData,
  type DataSourcePluginMeta,
  type DataSourceSettings,
  urlUtil,
  locationUtil,
} from '@grafana/data';

const pluginAddUrlPrefix = '/plugins/add/';

export const constructDataSourceExploreUrl = (dataSource: DataSourceSettings<DataSourceJsonData, {}>) => {
  const exploreState = JSON.stringify({ datasource: dataSource.name, context: 'explore' });
  const exploreUrl = urlUtil.renderUrl(locationUtil.assureBaseUrl('/explore'), { left: exploreState });

  return exploreUrl;
};

export const isDataSourcePluginInstallable = (plugin: DataSourcePluginMeta) => {
  if (plugin.enabled === false) {
    return true;
  }

  return plugin.info.links?.some((link) => link.url === `${pluginAddUrlPrefix}${plugin.id}`) ?? false;
};
