import { keyBy } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';

import { MockDataSourceSrv } from '../mocks';

/**
 * Sets up the data sources for the tests.
 * Sets up both config object from grafana/runtime and the data source server
 * @param configs data source instance settings. Use **mockDataSource** to create mock settings
 */
export function setupDataSources(...configs: DataSourceInstanceSettings[]) {
  config.datasources = keyBy(configs, (c) => c.name);
  setDataSourceSrv(new MockDataSourceSrv(config.datasources));
}
