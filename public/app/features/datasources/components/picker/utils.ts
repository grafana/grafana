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

export function useGetDatasources(filters: GetDataSourceListFilters) {
  const [value = [], setStorage] = useLocalStorage<string[]>(LOCAL_STORAGE_KEY, []);

  const dataSourceSrv = getDataSourceSrv();

  const dataSources = dataSourceSrv.getList(filters);

  const updateStorage = (ds: DataSourceInstanceSettings) => {
    if (ds.meta.builtIn) {
      return; //Prevent storing the built in datasources (-- Grafana --, -- Mixed --,  -- Dashboard --)
    }
    setStorage([ds.uid, ...value].slice(0, 5));
  };

  const recentlyUsed = value
    .map((dsUID) => dataSources.find((ds) => ds.uid === dsUID))
    .filter((ds): ds is DataSourceInstanceSettings => !!ds); //Custom typeguard to make sure ds is not undefined
  const otherDataSources = dataSources.filter((ds) => !value.includes(ds.uid));

  return { dataSources: [...recentlyUsed, ...otherDataSources], updateStorage };
}

export function useGetDatasource(dataSource: string | DataSourceRef | DataSourceInstanceSettings | null | undefined) {
  const dataSourceSrv = getDataSourceSrv();

  if (!dataSource) {
    return undefined;
  }

  if (typeof dataSource === 'string') {
    return dataSourceSrv.getInstanceSettings(dataSource);
  }

  return dataSourceSrv.getInstanceSettings(dataSource);
}
