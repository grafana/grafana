import type { DataSourceJsonData, DataSourceSettings } from '@grafana/data/types';
import { urlUtil, locationUtil } from '@grafana/data/utils';

export const constructDataSourceExploreUrl = (dataSource: DataSourceSettings<DataSourceJsonData, {}>) => {
  const exploreState = JSON.stringify({ datasource: dataSource.name, context: 'explore' });
  const exploreUrl = urlUtil.renderUrl(locationUtil.assureBaseUrl('/explore'), { left: exploreState });

  return exploreUrl;
};
