import { keyBy } from 'lodash';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';
import { initDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

/**
 * Sets up the data sources for the tests.
 * Sets up the config object from grafana/runtime, the legacy data source service and the
 * settings cache backing the async getDataSourceInstanceSettings API
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
  initDataSourceInstanceSettings(datasourceSettings, defaultDatasourceName);

  return dataSourceSrv;
}
