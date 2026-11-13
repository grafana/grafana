import { type DataSourceInstanceSettings, type DataSourceJsonData, type DataSourceRef } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import {
  initLastUsedDatasourceKeyForDashboard,
  setLastUsedDatasourceKeyForDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { type QueryGroupDataSource } from 'app/types/query';

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

export interface DataSourcePickerLookups {
  upperCaseNameByUid: Map<string, string>;
  lowerCaseNameByUid: Map<string, string>;
  favoriteUids: Set<string>;
  variableUids: Set<string>;
  recentUidToIndex: Map<string, number>;
}

export function buildDataSourcePickerLookups(
  dataSources: DataSourceInstanceSettings[],
  favoriteUids: string[],
  recentUids: string[],
  variableUids: string[]
): DataSourcePickerLookups {
  const upperCaseNameByUid = new Map<string, string>();
  const lowerCaseNameByUid = new Map<string, string>();
  for (const ds of dataSources) {
    upperCaseNameByUid.set(ds.uid, ds.name.toUpperCase());
    lowerCaseNameByUid.set(ds.uid, ds.name.toLowerCase());
  }
  const recentUidToIndex = new Map<string, number>();
  for (let i = 0; i < recentUids.length; i++) {
    recentUidToIndex.set(recentUids[i], i);
  }
  return {
    upperCaseNameByUid,
    lowerCaseNameByUid,
    favoriteUids: new Set(favoriteUids),
    variableUids: new Set(variableUids),
    recentUidToIndex,
  };
}

export function buildDataSourceComparator(
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined,
  lookups: DataSourcePickerLookups
) {
  const currentUid = current ? (typeof current === 'string' ? current : current.uid) : undefined;
  const { upperCaseNameByUid, favoriteUids, variableUids, recentUidToIndex } = lookups;

  return (a: DataSourceInstanceSettings, b: DataSourceInstanceSettings) => {
    const nameA = upperCaseNameByUid.get(a.uid) ?? a.name.toUpperCase();
    const nameB = upperCaseNameByUid.get(b.uid) ?? b.name.toUpperCase();

    if (currentUid !== undefined) {
      if (a.uid === currentUid) {
        return -1;
      }
      if (b.uid === currentUid) {
        return 1;
      }
    }

    const aIsFavorite = favoriteUids.has(a.uid);
    const bIsFavorite = favoriteUids.has(b.uid);
    if (aIsFavorite && !bIsFavorite) {
      return -1;
    } else if (bIsFavorite && !aIsFavorite) {
      return 1;
    } else if (aIsFavorite && bIsFavorite) {
      return nameA < nameB ? -1 : 1;
    }

    const aIndex = recentUidToIndex.get(a.uid) ?? -1;
    const bIndex = recentUidToIndex.get(b.uid) ?? -1;
    if (aIndex > -1 && aIndex > bIndex) {
      return -1;
    }
    if (bIndex > -1 && bIndex > aIndex) {
      return 1;
    }

    const aIsVariable = variableUids.has(a.uid);
    const bIsVariable = variableUids.has(b.uid);
    if (aIsVariable && !bIsVariable) {
      return -1;
    } else if (bIsVariable && !aIsVariable) {
      return 1;
    }

    if (a.meta.builtIn && !b.meta.builtIn) {
      return 1;
    } else if (b.meta.builtIn && !a.meta.builtIn) {
      return -1;
    }

    return nameA < nameB ? -1 : 1;
  };
}

export function buildDataSourceSearchMatcher(
  lookups: DataSourcePickerLookups,
  searchTerm: string
): (ds: DataSourceInstanceSettings) => boolean {
  const normalizedSearch = (searchTerm ?? '').toLowerCase();
  if (normalizedSearch === '') {
    return () => true;
  }
  const { lowerCaseNameByUid } = lookups;
  return (ds) => (lowerCaseNameByUid.get(ds.uid) ?? ds.name.toLowerCase()).includes(normalizedSearch);
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
