import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import {
  initLastUsedDatasourceKeyForDashboard,
  setLastUsedDatasourceKeyForDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { QueryGroupDataSource } from 'app/types/query';

export function isDataSourceMatch(
  ds: DataSourceInstanceSettings | undefined,
  current: string | DataSourceInstanceSettings | DataSourceRef | null | undefined
): boolean {
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
    return undefined;
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

  return undefined;
}

export function getDataSourceCompareFn(
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined,
  recentlyUsedDataSources: string[],
  dataSourceVariablesIDs: string[]
) {
  const cmpDataSources = (a: DataSourceInstanceSettings, b: DataSourceInstanceSettings) => {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();

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
    }

    // Sort built in DataSources to the bottom and alphabetically by name.
    if (a.meta.builtIn && !b.meta.builtIn) {
      return 1;
    } else if (b.meta.builtIn && !a.meta.builtIn) {
      return -1;
    }

    // Sort the rest alphabetically by name.
    return nameA < nameB ? -1 : 1;
  };

  return cmpDataSources;
}

/**
 * Given a data source and a search term, returns true if the data source matches the search term.
 * Useful to filter data sources by name containing an string.
 * @param ds
 * @param searchTerm
 * @returns
 */
export function matchDataSourceWithSearch(ds: DataSourceInstanceSettings, searchTerm = '') {
  return ds.name.toLowerCase().includes(searchTerm.toLowerCase());
}

export function storeLastUsedDataSourceInLocalStorage(datasource: QueryGroupDataSource) {
  if (!datasource.uid) {
    return;
  }

  const dashboardUid = getDashboardSrv().getCurrent()?.uid ?? '';
  // if datasource is MIXED reset datasource uid in storage, because Mixed datasource can contain multiple ds
  if (datasource.uid === MIXED_DATASOURCE_NAME) {
    return initLastUsedDatasourceKeyForDashboard(dashboardUid!);
  }

  setLastUsedDatasourceKeyForDashboard(dashboardUid, datasource.uid);
}
