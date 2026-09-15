import { keyBy } from 'lodash';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

/**
 * Sets up the data sources for the tests.
 * Sets up both config object from grafana/runtime and the data source server
 * @param configs data source instance settings. Use **mockDataSource** to create mock settings
 */
export function setupDataSources(...configs: DataSourceInstanceSettings[]) {
  const dataSourceSrv = new DatasourceSrv();
  const datasourceSettings = keyBy(configs, (c) => c.name);

  const defaultDatasource = configs.find((c) => c.isDefault);
  config.datasources = datasourceSettings;
  dataSourceSrv.init(config.datasources, defaultDatasource?.name || config.defaultDatasource);
  setDataSourceSrv(dataSourceSrv);
  // Also seed the newer instance-settings cache that getDataSourceInstanceSettings and friends read
  // from, so code using those APIs doesn't quietly fall back to the legacy service.
  setDataSourceInstanceSettings(datasourceSettings, defaultDatasource?.name || config.defaultDatasource);

  return dataSourceSrv;
}
