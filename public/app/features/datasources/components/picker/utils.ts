import { useLocalStorage } from 'react-use';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef } from '@grafana/data';
import { GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

const LOCAL_STORAGE_KEY = 'grafana.features.datasources.components.picker.DataSourceDropDown.history';

export function isDataSourceMatch(
  ds: DataSourceInstanceSettings | undefined,
  current: string | DataSourceInstanceSettings | DataSourceRef | null | undefined
): boolean | undefined {
  if (!ds) {
    return false;
  }
  if (!current) {
    return false;
  }
  if (typeof current === 'string') {
    return ds.uid === current;
  }
  return ds.uid === current.uid;
}

export function dataSourceLabel(
  dataSource: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined
) {
  if (!dataSource) {
    return 'Unknown';
  }

  if (typeof dataSource === 'string') {
    return `${dataSource} - not found`;
  }

  if ('name' in dataSource) {
    return dataSource.name;
  }

  if (dataSource.uid) {
    return `${dataSource.uid} - not found`;
  }

  return 'Unknown';
}

/**
 * Stores the uid of the last 5 data sources selected by the user
 *
 * @returns function for pushing a data source uid to the store
 */
export function useRecentlyUsedDataSources() {
  const [value = [], setStorage] = useLocalStorage<string[]>(LOCAL_STORAGE_KEY, []);

  const pushRecentlyUsedDataSource = (ds: DataSourceInstanceSettings) => {
    if (ds.meta.builtIn) {
      // Prevent storing the built in datasources (-- Grafana --, -- Mixed --,  -- Dashboard --)
      return;
    }
    if (value.includes(ds.uid)) {
      // Prevent storing multiple copies of the same data source, put it at the front of the array instead.
      value.splice(
        value.findIndex((dsUid) => ds.uid === dsUid),
        1
      );
      setStorage([ds.uid, ...value]);
    } else {
      setStorage([ds.uid, ...value].slice(0, 5));
    }
  };

  return { recentlyUsedDataSources: value, pushRecentlyUsedDataSource };
}

export function useDatasources(filters: GetDataSourceListFilters) {
  const dataSourceSrv = getDataSourceSrv();
  const dataSources = dataSourceSrv.getList(filters);

  return dataSources;
}

export function useDatasource(dataSource: string | DataSourceRef | DataSourceInstanceSettings | null | undefined) {
  const dataSourceSrv = getDataSourceSrv();

  if (!dataSource) {
    return undefined;
  }

  if (typeof dataSource === 'string') {
    return dataSourceSrv.getInstanceSettings(dataSource);
  }

  return dataSourceSrv.getInstanceSettings(dataSource);
}
