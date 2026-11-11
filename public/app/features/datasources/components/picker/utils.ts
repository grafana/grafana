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

export interface DataSourceSortOptions {
  current?: DataSourceRef | DataSourceInstanceSettings | string | null;
  /** UIDs of recently used data sources, the last one being the most recent */
  recentlyUsed?: string[];
  /** UIDs of data source template variables, e.g. `${ds}` */
  variableIds?: string[];
  favorites?: string[];
}

// Sort groups, in display order
const SORT_GROUP_CURRENT = 0;
const SORT_GROUP_FAVORITE = 1;
const SORT_GROUP_RECENT = 2;
const SORT_GROUP_VARIABLE = 3;
const SORT_GROUP_OTHER = 4;
const SORT_GROUP_BUILT_IN = 5;

interface SortKey {
  ds: DataSourceInstanceSettings;
  group: number;
  /** Tie-breaker inside a group, before the name */
  rank: number;
  name: string;
}

/**
 * Returns a sorted copy of the data sources: current, favorites, recently used (most recent first), variables,
 * the rest, and built-in data sources last. Within a group data sources are sorted by name, ignoring case.
 *
 * Sort keys are computed once per data source rather than once per comparison, as orgs can have thousands of
 * data sources.
 */
export function sortDataSources(
  dataSources: DataSourceInstanceSettings[],
  { current, recentlyUsed = [], variableIds = [], favorites = [] }: DataSourceSortOptions = {}
): DataSourceInstanceSettings[] {
  const currentUid = typeof current === 'string' ? current : current?.uid;
  const favoriteSet = new Set(favorites);
  const variableSet = new Set(variableIds);
  const recentIndex = new Map<string, number>();
  recentlyUsed.forEach((uid, index) => recentIndex.set(uid, index));

  const keys: SortKey[] = dataSources.map((ds) => {
    const name = ds.name.toUpperCase();
    if (currentUid && ds.uid === currentUid) {
      return { ds, group: SORT_GROUP_CURRENT, rank: 0, name };
    }
    if (favoriteSet.has(ds.uid)) {
      return { ds, group: SORT_GROUP_FAVORITE, rank: 0, name };
    }
    const recent = recentIndex.get(ds.uid);
    if (recent !== undefined) {
      return { ds, group: SORT_GROUP_RECENT, rank: -recent, name };
    }
    if (variableSet.has(ds.uid)) {
      return { ds, group: SORT_GROUP_VARIABLE, rank: ds.meta.builtIn ? 1 : 0, name };
    }
    return { ds, group: ds.meta.builtIn ? SORT_GROUP_BUILT_IN : SORT_GROUP_OTHER, rank: 0, name };
  });

  keys.sort((a, b) => {
    if (a.group !== b.group) {
      return a.group - b.group;
    }
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    if (a.name === b.name) {
      return 0;
    }
    return a.name < b.name ? -1 : 1;
  });

  return keys.map((key) => key.ds);
}

/**
 * Lowercased search strings, computed once per list so searching doesn't allocate per keystroke.
 */
export interface DataSourceSearchIndex {
  dataSources: DataSourceInstanceSettings[];
  names: string[];
}

export function createDataSourceSearchIndex(dataSources: DataSourceInstanceSettings[]): DataSourceSearchIndex {
  return {
    dataSources,
    names: dataSources.map((ds) => ds.name.toLowerCase()),
  };
}

/**
 * Returns the data sources whose name contains the search, ignoring case.
 *
 * Returns the indexed list itself when the search is empty.
 */
export function searchDataSources(index: DataSourceSearchIndex, search = ''): DataSourceInstanceSettings[] {
  if (!search) {
    return index.dataSources;
  }
  const term = search.toLowerCase();
  return index.dataSources.filter((_, i) => index.names[i].includes(term));
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
