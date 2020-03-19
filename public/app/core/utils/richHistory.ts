// Libraries
import _ from 'lodash';

// Services & Utils
import { DataQuery, ExploreMode } from '@grafana/data';
import { renderUrl } from 'app/core/utils/url';
import store from 'app/core/store';
import { serializeStateToUrlParam, SortOrder } from './explore';
import { getExploreDatasources } from '../../features/explore/state/selectors';

// Types
import { ExploreUrlState, RichHistoryQuery } from 'app/types/explore';

const RICH_HISTORY_KEY = 'grafana.explore.richHistory';

export const RICH_HISTORY_SETTING_KEYS = {
  retentionPeriod: 'grafana.explore.richHistory.retentionPeriod',
  starredTabAsFirstTab: 'grafana.explore.richHistory.starredTabAsFirstTab',
  activeDatasourceOnly: 'grafana.explore.richHistory.activeDatasourceOnly',
  datasourceFilters: 'grafana.explore.richHistory.datasourceFilters',
};

/*
 * Add queries to rich history. Save only queries within the retention period, or that are starred.
 * Side-effect: store history in local storage
 */

export function addToRichHistory(
  richHistory: RichHistoryQuery[],
  datasourceId: string,
  datasourceName: string | null,
  queries: string[],
  starred: boolean,
  comment: string | null,
  sessionName: string
): any {
  const ts = Date.now();
  /* Save only queries, that are not falsy (e.g. empty strings, null) */
  const queriesToSave = queries.filter(expr => Boolean(expr));

  const retentionPeriod = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
  const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);

  /* Keep only queries, that are within the selected retention period or that are starred.
   * If no queries, initialize with exmpty array
   */
  const queriesToKeep = richHistory.filter(q => q.ts > retentionPeriodLastTs || q.starred === true) || [];

  if (queriesToSave.length > 0) {
    if (
      /* Don't save duplicated queries for the same datasource */
      queriesToKeep.length > 0 &&
      JSON.stringify(queriesToSave) === JSON.stringify(queriesToKeep[0].queries) &&
      JSON.stringify(datasourceName) === JSON.stringify(queriesToKeep[0].datasourceName)
    ) {
      return richHistory;
    }

    let newHistory = [
      { queries: queriesToSave, ts, datasourceId, datasourceName, starred, comment, sessionName },
      ...queriesToKeep,
    ];

    /* Combine all queries of a datasource type into one rich history */
    const isSaved = store.setObject(RICH_HISTORY_KEY, newHistory);

    /* If newHistory is succesfully saved, return it. Otherwise return not updated richHistory.  */
    if (isSaved) {
      return newHistory;
    } else {
      return richHistory;
    }
  }

  return richHistory;
}

export function getRichHistory() {
  return store.getObject(RICH_HISTORY_KEY, []);
}

export function deleteAllFromRichHistory() {
  return store.delete(RICH_HISTORY_KEY);
}

export function updateStarredInRichHistory(richHistory: RichHistoryQuery[], ts: number) {
  const updatedQueries = richHistory.map(query => {
    /* Timestamps are currently unique - we can use them to identify specific queries */
    if (query.ts === ts) {
      const isStarred = query.starred;
      const updatedQuery = Object.assign({}, query, { starred: !isStarred });
      return updatedQuery;
    }
    return query;
  });

  store.setObject(RICH_HISTORY_KEY, updatedQueries);
  return updatedQueries;
}

export function updateCommentInRichHistory(
  richHistory: RichHistoryQuery[],
  ts: number,
  newComment: string | undefined
) {
  const updatedQueries = richHistory.map(query => {
    if (query.ts === ts) {
      const updatedQuery = Object.assign({}, query, { comment: newComment });
      return updatedQuery;
    }
    return query;
  });

  store.setObject(RICH_HISTORY_KEY, updatedQueries);
  return updatedQueries;
}

export function deleteQueryInRichHistory(richHistory: RichHistoryQuery[], ts: number) {
  const updatedQueries = richHistory.filter(query => query.ts !== ts);
  store.setObject(RICH_HISTORY_KEY, updatedQueries);
  return updatedQueries;
}

export const sortQueries = (array: RichHistoryQuery[], sortOrder: SortOrder) => {
  let sortFunc;

  if (sortOrder === SortOrder.Ascending) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  }
  if (sortOrder === SortOrder.Descending) {
    sortFunc = (a: RichHistoryQuery, b: RichHistoryQuery) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0);
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

export const copyStringToClipboard = (string: string) => {
  const el = document.createElement('textarea');
  el.value = string;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

export const createUrlFromRichHistory = (query: RichHistoryQuery) => {
  const queries = query.queries.map(query => ({ expr: query }));
  const exploreState: ExploreUrlState = {
    /* Default range, as we are not saving timerange in rich history */
    range: { from: 'now-1h', to: 'now' },
    datasource: query.datasourceName,
    queries,
    /* Default mode. In the future, we can also save the query mode */
    mode: query.datasourceId === 'loki' ? ExploreMode.Logs : ExploreMode.Metrics,
    ui: {
      showingGraph: true,
      showingLogs: true,
      showingTable: true,
    },
    context: 'explore',
  };

  const serializedState = serializeStateToUrlParam(exploreState, true);
  const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)[0];
  const url = renderUrl(`${baseUrl}/explore`, { left: serializedState });
  return url;
};

/* Needed for slider in Rich history to map numerical values to meaningful strings */
export const mapNumbertoTimeInSlider = (num: number) => {
  let str;
  switch (num) {
    case 0:
      str = 'today';
      break;
    case 1:
      str = 'yesterday';
      break;
    case 7:
      str = 'a week ago';
      break;
    case 14:
      str = 'two weeks ago';
      break;
    default:
      str = `${num} days ago`;
  }

  return str;
};

export const createRetentionPeriodBoundary = (days: number, isLastTs: boolean) => {
  const today = new Date();
  const date = new Date(today.setDate(today.getDate() - days));
  /*
   * As a retention period boundaries, we consider:
   * - The last timestamp equals to the 24:00 of the last day of retention
   * - The first timestamp that equals to the 00:00 of the first day of retention
   */
  const boundary = isLastTs ? date.setHours(24, 0, 0, 0) : date.setHours(0, 0, 0, 0);
  return boundary;
};

export function createDateStringFromTs(ts: number) {
  const date = new Date(ts);
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();
  return `${month} ${day}`;
}

export function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

export function createQueryHeading(query: RichHistoryQuery, sortOrder: SortOrder) {
  let heading = '';
  if (sortOrder === SortOrder.DatasourceAZ || sortOrder === SortOrder.DatasourceZA) {
    heading = query.datasourceName;
  } else {
    heading = createDateStringFromTs(query.ts);
  }
  return heading;
}

export function isParsable(string: string) {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
}

export function createDataQuery(query: RichHistoryQuery, queryString: string, index: number) {
  let dataQuery;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  isParsable(queryString)
    ? (dataQuery = JSON.parse(queryString))
    : (dataQuery = { expr: queryString, refId: letters[index], datasource: query.datasourceName });

  return dataQuery;
}

export function mapQueriesToHeadings(query: RichHistoryQuery[], sortOrder: SortOrder) {
  let mappedQueriesToHeadings: any = {};

  query.forEach(q => {
    let heading = createQueryHeading(q, sortOrder);
    if (!(heading in mappedQueriesToHeadings)) {
      mappedQueriesToHeadings[heading] = [q];
    } else {
      mappedQueriesToHeadings[heading] = [...mappedQueriesToHeadings[heading], q];
    }
  });

  return mappedQueriesToHeadings;
}

/* Create datasource list with images. If specific datasource retrieved from Rich history is not part of
 * exploreDatasources add generic datasource image and add property isRemoved = true.
 */
export function createDatasourcesList(queriesDatasources: string[]) {
  const exploreDatasources = getExploreDatasources();
  const datasources: Array<{ label: string; value: string; imgUrl: string; isRemoved: boolean }> = [];

  queriesDatasources.forEach(queryDsName => {
    const index = exploreDatasources.findIndex(exploreDs => exploreDs.name === queryDsName);
    if (index !== -1) {
      datasources.push({
        label: queryDsName,
        value: queryDsName,
        imgUrl: exploreDatasources[index].meta.info.logos.small,
        isRemoved: false,
      });
    } else {
      datasources.push({
        label: queryDsName,
        value: queryDsName,
        imgUrl: 'public/img/icn-datasource.svg',
        isRemoved: true,
      });
    }
  });
  return datasources;
}
