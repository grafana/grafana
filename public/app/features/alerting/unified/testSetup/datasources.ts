import { DataSourceInstanceSettings } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';

import { MockDataSourceSrv } from '../mocks';

/**
 * Sets up the data sources for the tests.
 * Sets up both config object from grafana/runtime and the data source server
 * @param configs data source instance settings. Use **mockDataSource** to create mock settings
 */
export function setupDatasources(...configs: DataSourceInstanceSettings[]) {
  const dataSources: Record<string, DataSourceInstanceSettings> = {};
  for (const ds of configs) {
    dataSources[ds.name] = ds;
  }

  config.datasources = dataSources;
  setDataSourceSrv(new MockDataSourceSrv(dataSources));
}
