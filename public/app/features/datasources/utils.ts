import { type DataSourceSettings, urlUtil, locationUtil } from '@grafana/data';

export const constructDataSourceExploreUrl = (dataSource: Pick<DataSourceSettings, 'name'>) => {
  const exploreState = JSON.stringify({ datasource: dataSource.name, context: 'explore' });
  const exploreUrl = urlUtil.renderUrl(locationUtil.assureBaseUrl('/explore'), { left: exploreState });

  return exploreUrl;
};
