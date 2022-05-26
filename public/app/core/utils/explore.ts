import { flatten, omit, uniq } from 'lodash';
import { Unsubscribable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  dateMath,
  DateTime,
  DefaultTimeZone,
  ExploreUrlState,
  HistoryItem,
  IntervalValues,
  isDateTime,
  LogsDedupStrategy,
  LogsSortOrder,
  rangeUtil,
  RawTimeRange,
  TimeFragment,
  TimeRange,
  TimeZone,
  toUtc,
  urlUtil,
} from '@grafana/data';
import { DataSourceSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import store from 'app/core/store';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { EXPLORE_GRAPH_STYLES, ExploreGraphStyle, ExploreId, QueryOptions, QueryTransaction } from 'app/types/explore';

import { config } from '../config';

import { getNextRefIdChar } from './query';

export const DEFAULT_RANGE = {
  from: 'now-1h',
  to: 'now',
};

export const DEFAULT_UI_STATE = {
  dedupStrategy: LogsDedupStrategy.none,
};

const MAX_HISTORY_ITEMS = 100;

export const LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
export const lastUsedDatasourceKeyForOrgId = (orgId: number) => `${LAST_USED_DATASOURCE_KEY}.${orgId}`;

export interface GetExploreUrlArguments {
  panel: PanelModel;
  /** Datasource service to query other datasources in case the panel datasource is mixed */
  datasourceSrv: DataSourceSrv;
  /** Time service to get the current dashboard range from */
  timeSrv: TimeSrv;
}

/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 */
export async function getExploreUrl(args: GetExploreUrlArguments): Promise<string | undefined> {
  const { panel, datasourceSrv, timeSrv } = args;
  let exploreDatasource = await datasourceSrv.get(panel.datasource);

  /** In Explore, we don't have legend formatter and we don't want to keep
   * legend formatting as we can't change it
   */
  let exploreTargets: DataQuery[] = panel.targets.map((t) => omit(t, 'legendFormat'));
  let url: string | undefined;

  // Mixed datasources need to choose only one datasource
  if (exploreDatasource.meta?.id === 'mixed' && exploreTargets) {
    // Find first explore datasource among targets
    for (const t of exploreTargets) {
      const datasource = await datasourceSrv.get(t.datasource || undefined);
      if (datasource) {
        exploreDatasource = datasource;
        exploreTargets = panel.targets.filter((t) => t.datasource === datasource.name);
        break;
      }
    }
  }

  if (exploreDatasource) {
    const range = timeSrv.timeRangeForUrl();
    let state: Partial<ExploreUrlState> = { range };
    if (exploreDatasource.interpolateVariablesInQueries) {
      const scopedVars = panel.scopedVars || {};
      state = {
        ...state,
        datasource: exploreDatasource.name,
        context: 'explore',
        queries: exploreDatasource.interpolateVariablesInQueries(exploreTargets, scopedVars),
      };
    } else {
      state = {
        ...state,
        datasource: exploreDatasource.name,
        context: 'explore',
        queries: exploreTargets.map((t) => ({ ...t, datasource: exploreDatasource.getRef() })),
      };
    }

    const exploreState = JSON.stringify(state);
    url = urlUtil.renderUrl('/explore', { left: exploreState });
  }

  return url;
}

export function buildQueryTransaction(
  exploreId: ExploreId,
  queries: DataQuery[],
  queryOptions: QueryOptions,
  range: TimeRange,
  scanning: boolean,
  timeZone?: TimeZone
): QueryTransaction {
  const key = queries.reduce((combinedKey, query) => {
    combinedKey += query.key;
    return combinedKey;
  }, '');

  const { interval, intervalMs } = getIntervals(range, queryOptions.minInterval, queryOptions.maxDataPoints);

  // Most datasource is using `panelId + query.refId` for cancellation logic.
  // Using `format` here because it relates to the view panel that the request is for.
  // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
  // Therefore panel id has to be unique.
  const panelId = `${key}`;

  const request: DataQueryRequest = {
    app: CoreApp.Explore,
    dashboardId: 0,
    // TODO probably should be taken from preferences but does not seem to be used anyway.
    timezone: timeZone || DefaultTimeZone,
    startTime: Date.now(),
    interval,
    intervalMs,
    // TODO: the query request expects number and we are using string here. Seems like it works so far but can create
    // issues down the road.
    panelId: panelId as any,
    targets: queries, // Datasources rely on DataQueries being passed under the targets key.
    range,
    requestId: 'explore_' + exploreId,
    rangeRaw: range.raw,
    scopedVars: {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
    },
    maxDataPoints: queryOptions.maxDataPoints,
    liveStreaming: queryOptions.liveStreaming,
  };

  return {
    queries,
    request,
    scanning,
    id: generateKey(), // reusing for unique ID
    done: false,
  };
}

export const clearQueryKeys: (query: DataQuery) => DataQuery = ({ key, ...rest }) => rest;

export const safeParseJson = (text?: string): any | undefined => {
  if (!text) {
    return;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
  }
};

export const safeStringifyValue = (value: any, space?: number) => {
  if (!value) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

const DEFAULT_GRAPH_STYLE: ExploreGraphStyle = 'lines';
// we use this function to take any kind of data we loaded
// from an external source (URL, localStorage, whatever),
// and extract the graph-style from it, or return the default
// graph-style if we are not able to do that.
// it is important that this function is able to take any form of data,
// (be it objects, or arrays, or booleans or whatever),
// and produce a best-effort graphStyle.
// note that typescript makes sure we make no mistake in this function.
// we do not rely on ` as ` or ` any `.
export const toGraphStyle = (data: unknown): ExploreGraphStyle => {
  const found = EXPLORE_GRAPH_STYLES.find((v) => v === data);
  return found ?? DEFAULT_GRAPH_STYLE;
};

export function parseUrlState(initial: string | undefined): ExploreUrlState {
  const parsed = safeParseJson(initial);
  const errorResult: any = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
    mode: null,
  };

  if (!parsed) {
    return errorResult;
  }

  return parsed;
}

export function generateKey(index = 0): string {
  return `Q-${uuidv4()}-${index}`;
}

export function generateEmptyQuery(queries: DataQuery[], index = 0): DataQuery {
  return { refId: getNextRefIdChar(queries), key: generateKey(index) };
}

export const generateNewKeyAndAddRefIdIfMissing = (target: DataQuery, queries: DataQuery[], index = 0): DataQuery => {
  const key = generateKey(index);
  const refId = target.refId || getNextRefIdChar(queries);

  return { ...target, refId, key };
};

/**
 * Ensure at least one target exists and that targets have the necessary keys
 */
export function ensureQueries(queries?: DataQuery[]): DataQuery[] {
  if (queries && typeof queries === 'object' && queries.length > 0) {
    const allQueries = [];
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      const key = generateKey(index);
      let refId = query.refId;
      if (!refId) {
        refId = getNextRefIdChar(allQueries);
      }

      allQueries.push({
        ...query,
        refId,
        key,
      });
    }
    return allQueries;
  }
  return [{ ...generateEmptyQuery(queries ?? []) }];
}

/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key, context and datasource.
 * FIXME: While this is reasonable for practical use cases, a query without any propery might still be "non-empty"
 * in its own scope, for instance when there's no user input needed. This might be the case for an hypothetic datasource in
 * which query options are only set in its config and the query object itself, as generated from its query editor it's always "empty"
 */
const validKeys = ['refId', 'key', 'context', 'datasource'];
export function hasNonEmptyQuery<TQuery extends DataQuery>(queries: TQuery[]): boolean {
  return (
    queries &&
    queries.some((query: any) => {
      const keys = Object.keys(query)
        .filter((key) => validKeys.indexOf(key) === -1)
        .map((k) => query[k])
        .filter((v) => v);
      return keys.length > 0;
    })
  );
}

/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory<T extends DataQuery>(
  history: Array<HistoryItem<T>>,
  datasourceId: string,
  queries: T[]
): Array<HistoryItem<T>> {
  const ts = Date.now();
  let updatedHistory = history;
  queries.forEach((query) => {
    updatedHistory = [{ query, ts }, ...updatedHistory];
  });

  if (updatedHistory.length > MAX_HISTORY_ITEMS) {
    updatedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS);
  }

  // Combine all queries of a datasource type into one history
  const historyKey = `grafana.explore.history.${datasourceId}`;
  try {
    store.setObject(historyKey, updatedHistory);
    return updatedHistory;
  } catch (error) {
    console.error(error);
    return history;
  }
}

export function clearHistory(datasourceId: string) {
  const historyKey = `grafana.explore.history.${datasourceId}`;
  store.delete(historyKey);
}

export const getQueryKeys = (queries: DataQuery[], datasourceInstance?: DataSourceApi | null): string[] => {
  const queryKeys = queries.reduce<string[]>((newQueryKeys, query, index) => {
    const primaryKey = datasourceInstance && datasourceInstance.name ? datasourceInstance.name : query.key;
    return newQueryKeys.concat(`${primaryKey}-${index}`);
  }, []);

  return queryKeys;
};

export const getTimeRange = (timeZone: TimeZone, rawRange: RawTimeRange, fiscalYearStartMonth: number): TimeRange => {
  let range = rangeUtil.convertRawToRange(rawRange, timeZone, fiscalYearStartMonth);

  if (range.to.isBefore(range.from)) {
    range = rangeUtil.convertRawToRange({ from: range.raw.to, to: range.raw.from }, timeZone, fiscalYearStartMonth);
  }

  return range;
};

const parseRawTime = (value: string | DateTime): TimeFragment | null => {
  if (value === null) {
    return null;
  }

  if (isDateTime(value)) {
    return value;
  }

  if (value.indexOf('now') !== -1) {
    return value;
  }
  if (value.length === 8) {
    return toUtc(value, 'YYYYMMDD');
  }
  if (value.length === 15) {
    return toUtc(value, 'YYYYMMDDTHHmmss');
  }
  // Backward compatibility
  if (value.length === 19) {
    return toUtc(value, 'YYYY-MM-DD HH:mm:ss');
  }

  // This should handle cases where value is an epoch time as string
  if (value.match(/^\d+$/)) {
    const epoch = parseInt(value, 10);
    return toUtc(epoch);
  }

  // This should handle ISO strings
  const time = toUtc(value);
  if (time.isValid()) {
    return time;
  }

  return null;
};

export const getTimeRangeFromUrl = (
  range: RawTimeRange,
  timeZone: TimeZone,
  fiscalYearStartMonth: number
): TimeRange => {
  const raw = {
    from: parseRawTime(range.from)!,
    to: parseRawTime(range.to)!,
  };

  return {
    from: dateMath.parse(raw.from, false, timeZone as any)!,
    to: dateMath.parse(raw.to, true, timeZone as any)!,
    raw,
  };
};

export const getValueWithRefId = (value?: any): any => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (value.refId) {
    return value;
  }

  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const refId = getValueWithRefId(value[key]);
    if (refId) {
      return refId;
    }
  }

  return undefined;
};

export const getRefIds = (value: any): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value !== 'object') {
    return [];
  }

  const keys = Object.keys(value);
  const refIds = [];
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (key === 'refId') {
      refIds.push(value[key]);
      continue;
    }
    refIds.push(getRefIds(value[key]));
  }

  return uniq(flatten(refIds));
};

export const refreshIntervalToSortOrder = (refreshInterval?: string) =>
  RefreshPicker.isLive(refreshInterval) ? LogsSortOrder.Ascending : LogsSortOrder.Descending;

export const convertToWebSocketUrl = (url: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
  if (backend.endsWith('/')) {
    backend = backend.slice(0, -1);
  }
  return `${backend}${url}`;
};

export const stopQueryState = (querySubscription: Unsubscribable | undefined) => {
  if (querySubscription) {
    querySubscription.unsubscribe();
  }
};

export function getIntervals(range: TimeRange, lowLimit?: string, resolution?: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return rangeUtil.calculateInterval(range, resolution, lowLimit);
}

export const copyStringToClipboard = (string: string) => {
  const el = document.createElement('textarea');
  el.value = string;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};
