import { useLocalStorage } from 'react-use';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef } from '@grafana/data';
import { GetDataSourceListFilters, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';

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
 * Stores the uid of the last 5 data sources selected by the user. The last UID is the one most recently used.
 */
export function useRecentlyUsedDataSources(): [string[], (ds: DataSourceInstanceSettings) => void] {
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
      setStorage([...value, ds.uid]);
    } else {
      setStorage([...value, ds.uid].slice(1, 6));
    }
  };

  return [value, pushRecentlyUsedDataSource];
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

export function getDataSourceCompareFn(
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined,
  recentlyUsedDataSources: string[],
  dataSourceVariablesIDs: string[]
) {
  const cmpDataSources = (a: DataSourceInstanceSettings, b: DataSourceInstanceSettings) => {
    // Sort the current ds before everything else.
    if (current && isDataSourceMatch(a, current)) {
      return -1;
    } else if (current && isDataSourceMatch(b, current)) {
      return 1;
    }

    // Sort recently used data sources by latest used, but after current.
    const aIndex = recentlyUsedDataSources.indexOf(a.uid);
    const bIndex = recentlyUsedDataSources.indexOf(b.uid);
    if (aIndex > -1 && aIndex > bIndex) {
      return -1;
    }
    if (bIndex > -1 && bIndex > aIndex) {
      return 1;
    }

    // Sort variables before the rest. Variables sorted alphabetically by name.
    const aIsVariable = dataSourceVariablesIDs.includes(a.uid);
    const bIsVariable = dataSourceVariablesIDs.includes(b.uid);
    if (aIsVariable && !bIsVariable) {
      return -1;
    } else if (bIsVariable && !aIsVariable) {
      return 1;
    } else if (bIsVariable && aIsVariable) {
      return a.name < b.name ? -1 : 1;
    }

    // Sort built in DataSources to the bottom and alphabetically by name.
    if (a.meta.builtIn && !b.meta.builtIn) {
      return 1;
    } else if (b.meta.builtIn && !a.meta.builtIn) {
      return -1;
    } else if (a.meta.builtIn && b.meta.builtIn) {
      return a.name < b.name ? -1 : 1;
    }

    // Sort the rest alphabetically by name.
    return a.name < b.name ? -1 : 1;
  };

  return cmpDataSources;
}
