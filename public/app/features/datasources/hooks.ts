import { useLocalStorage } from 'react-use';

import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';
import { GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';

const LOCAL_STORAGE_KEY = 'grafana.features.datasources.components.picker.DataSourceDropDown.history';

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
