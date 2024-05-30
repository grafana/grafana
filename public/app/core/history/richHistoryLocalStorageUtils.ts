import { omit } from 'lodash';

import { dateTime, dateTimeForTimeZone } from '@grafana/data';

import { RichHistoryQuery } from '../../types';
import { SortOrder } from '../utils/richHistoryTypes';

/**
 * Temporary place for local storage specific items that are still in use in richHistory.ts
 *
 * Should be migrated to RichHistoryLocalStorage.ts
 */

export function filterAndSortQueries(
  queries: RichHistoryQuery[],
  sortOrder: SortOrder,
  listOfDatasourceFilters: string[],
  searchFilter: string,
  // Number of days since now. So now - timeFilter[1] to now - timeFilter[0].
  timeFilter?: [number, number],
  timezone?: string
) {
  const filteredQueriesByDs = filterQueriesByDataSource(queries, listOfDatasourceFilters);
  const filteredQueriesByDsAndSearchFilter = filterQueriesBySearchFilter(filteredQueriesByDs, searchFilter);
  const filteredQueriesToBeSorted = timeFilter
    ? filterQueriesByTime(filteredQueriesByDsAndSearchFilter, timeFilter, timezone)
    : filteredQueriesByDsAndSearchFilter;

  return sortQueries(filteredQueriesToBeSorted, sortOrder);
}

export const createRetentionPeriodBoundary = (days: number, options: { isLastTs: boolean; tz?: string }): number => {
  const now = options.tz ? dateTimeForTimeZone(options.tz) : dateTime();
  now.add(-days, 'd');

  /*
   * As a retention period boundaries, we consider:
   * - The last timestamp equals to the 24:00 of the last day of retention
   * - The first timestamp that equals to the 00:00 of the first day of retention
   */
  const boundary = options.isLastTs ? now.endOf('d') : now.startOf('d');
  return boundary.valueOf();
};

function filterQueriesByTime(queries: RichHistoryQuery[], timeFilter: [number, number], tz?: string) {
  const filter1 = createRetentionPeriodBoundary(timeFilter[0], { isLastTs: true, tz });
  const filter2 = createRetentionPeriodBoundary(timeFilter[1], { isLastTs: false, tz });
  return queries.filter((q) => q.createdAt < filter1 && q.createdAt > filter2);
}

function filterQueriesByDataSource(queries: RichHistoryQuery[], listOfDatasourceFilters: string[]) {
  return listOfDatasourceFilters.length > 0
    ? queries.filter((q) => listOfDatasourceFilters.includes(q.datasourceName))
    : queries;
}

function filterQueriesBySearchFilter(queries: RichHistoryQuery[], searchFilter: string) {
  return queries.filter((query) => {
    if (query.comment.includes(searchFilter)) {
      return true;
    }

    const listOfMatchingQueries = query.queries.filter((query) =>
      // Remove fields in which we don't want to be searching
      Object.values(omit(query, ['datasource', 'key', 'refId', 'hide', 'queryType'])).some((value) =>
        value?.toString().includes(searchFilter)
      )
    );

    return listOfMatchingQueries.length > 0;
  });
}

export const sortQueries = (array: RichHistoryQuery[], sortOrder: SortOrder) => {
  let sortFunc;

  if (sortOrder === SortOrder.Ascending) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  }
  if (sortOrder === SortOrder.Descending) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  }

  if (sortOrder === SortOrder.DatasourceZA) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) =>
      a.datasourceName < b.datasourceName ? -1 : a.datasourceName > b.datasourceName ? 1 : 0;
  }

  if (sortOrder === SortOrder.DatasourceAZ) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) =>
      a.datasourceName < b.datasourceName ? 1 : a.datasourceName > b.datasourceName ? -1 : 0;
  }

  return array.sort(sortFunc);
};

export const RICH_HISTORY_SETTING_KEYS = {
  retentionPeriod: 'grafana.explore.richHistory.retentionPeriod',
  starredTabAsFirstTab: 'grafana.explore.richHistory.starredTabAsFirstTab',
  legacyActiveDatasourceOnly: 'grafana.explore.richHistory.activeDatasourceOnly', // @deprecated
  activeDatasourcesOnly: 'grafana.explore.richHistory.activeDatasourcesOnly',
  datasourceFilters: 'grafana.explore.richHistory.datasourceFilters',
};
