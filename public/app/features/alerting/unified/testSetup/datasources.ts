import { keyBy } from 'lodash';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

/**
 * Sets up the data sources for the tests: the legacy `DataSourceSrv` and the in-memory cache
 * backing the async `@grafana/runtime/unstable` APIs, so tests work with either.
 * @param configs data source instance settings. Use **mockDataSource** to create mock settings
 */
export function setupDataSources(...configs: DataSourceInstanceSettings[]) {
  const dataSourceSrv = new DatasourceSrv();
  const datasourceSettings = keyBy(configs, (c) => c.name);

  const defaultDatasource = configs.find((c) => c.isDefault);
  const defaultDatasourceName = defaultDatasource?.name || config.defaultDatasource;
  config.datasources = datasourceSettings;
  dataSourceSrv.init(config.datasources, defaultDatasourceName);
  setDataSourceSrv(dataSourceSrv);
  setDataSourceInstanceSettings(datasourceSettings, defaultDatasourceName);

  return dataSourceSrv;
}
