import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef } from '@grafana/data';
import { GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

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

export function dataSourceName(
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
  const dataSourceSrv = getDataSourceSrv();

  return dataSourceSrv.getList(filters);
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
