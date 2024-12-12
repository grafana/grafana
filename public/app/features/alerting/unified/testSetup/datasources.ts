import { keyBy } from 'lodash';

import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';
import { mockDataSources } from 'app/features/alerting/unified/test/fixtures';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

/**
 * Ensure that our mock data sources are sane and don't contain any accidental duplication of names or UIDs
 *  */
const sanityCheckDataSources = (configs: DataSourceInstanceSettings[]) => {
  const nameSet = new Set<string>();
  const uidSet = new Set<string>();

  (configs || []).forEach((dataSource) => {
    if (nameSet.has(dataSource.name)) {
      throw new Error(`Duplicate mock datasource name found: ${dataSource.name}`);
    }

    if (uidSet.has(dataSource.uid)) {
      throw new Error(`Duplicate mock datasource UID found: ${dataSource.uid}`);
    }

    nameSet.add(dataSource.name);
    uidSet.add(dataSource.uid);
  });
};

/**
 * Sets up the data sources for the tests.
 * Sets up both config object from grafana/runtime and the data source server
 * @param configs data source instance settings. Use **mockDataSource** to create mock settings
 */
export function setupDataSources(...configs: DataSourceInstanceSettings[]) {
  sanityCheckDataSources(configs);
  const dataSourceSrv = new DatasourceSrv();
  const datasourceSettings = keyBy(configs, (c) => c.name);

  const defaultDatasource = configs.find((c) => c.isDefault);
  config.datasources = datasourceSettings;
  dataSourceSrv.init(config.datasources, defaultDatasource?.name || config.defaultDatasource);
  setDataSourceSrv(dataSourceSrv);

  return dataSourceSrv;
}
export const setupAlertingDataSources = (dataSources = mockDataSources) => {
  const dataSourceService = setupDataSources(...Object.values(dataSources));
  return { dataSources, dataSourceService };
};

export const changeDataSourceSettings = <T extends DataSourceJsonData>(
  uid: keyof typeof mockDataSources,
  partialSettings: Partial<DataSourceInstanceSettings<T>>
) => {
  const dataSource = mockDataSources[uid];

  const updatedDataSources = {
    ...mockDataSources,
    [uid]: { ...dataSource, ...partialSettings },
  };

  return setupAlertingDataSources(updatedDataSources);
};
