// Libraries
import _ from 'lodash';
import { Unsubscribable } from 'rxjs';
// Services & Utils
import {
  DataQuery,
  CoreApp,
  DataQueryError,
  DataQueryRequest,
  DataSourceApi,
  dateMath,
  DefaultTimeZone,
  HistoryItem,
  IntervalValues,
  LogRowModel,
  LogsDedupStrategy,
  LogsModel,
  PanelModel,
  RawTimeRange,
  TimeFragment,
  TimeRange,
  TimeZone,
  toUtc,
  ExploreMode,
} from '@grafana/data';
import { renderUrl } from 'app/core/utils/url';
import store from 'app/core/store';
import kbn from 'app/core/utils/kbn';
import { getNextRefIdChar } from './query';
// Types
import { RefreshPicker } from '@grafana/ui';
import { ExploreUrlState, QueryOptions, QueryTransaction } from 'app/types/explore';
import { config } from '../config';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DataSourceSrv } from '@grafana/runtime';

export const DEFAULT_RANGE = {
  from: 'now-1h',
  to: 'now',
};

export const DEFAULT_UI_STATE = {
  showingTable: true,
  showingGraph: true,
  showingLogs: true,
  dedupStrategy: LogsDedupStrategy.none,
};

const MAX_HISTORY_ITEMS = 100;

export const LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
export const lastUsedDatasourceKeyForOrgId = (orgId: number) => `${LAST_USED_DATASOURCE_KEY}.${orgId}`;

/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 *
 * @param panelTargets The origin panel's query targets
 * @param panelDatasource The origin panel's datasource
 * @param datasourceSrv Datasource service to query other datasources in case the panel datasource is mixed
 * @param timeSrv Time service to get the current dashboard range from
 */
export interface GetExploreUrlArguments {
  panel: PanelModel;
  panelTargets: DataQuery[];
  panelDatasource: DataSourceApi;
  datasourceSrv: DataSourceSrv;
  timeSrv: TimeSrv;
}
export async function getExploreUrl(args: GetExploreUrlArguments) {
  const { panel, panelTargets, panelDatasource, datasourceSrv, timeSrv } = args;
  let exploreDatasource = panelDatasource;
  let exploreTargets: DataQuery[] = panelTargets;
  let url: string;

  // Mixed datasources need to choose only one datasource
  if (panelDatasource.meta.id === 'mixed' && exploreTargets) {
    // Find first explore datasource among targets
    for (const t of exploreTargets) {
      const datasource = await datasourceSrv.get(t.datasource);
      if (datasource) {
        exploreDatasource = datasource;
        exploreTargets = panelTargets.filter(t => t.datasource === datasource.name);
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
        queries: exploreTargets.map(t => ({ ...t, datasource: exploreDatasource.name })),
      };
    }

    const exploreState = JSON.stringify({ ...state, originPanelId: panel.id });
    url = renderUrl('/explore', { left: exploreState });
  }
  return url;
}

export function buildQueryTransaction(
  queries: DataQuery[],
  queryOptions: QueryOptions,
  range: TimeRange,
  scanning: boolean
): QueryTransaction {
  const configuredQueries = queries.map(query => ({ ...query, ...queryOptions }));
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
    timezone: DefaultTimeZone,
    startTime: Date.now(),
    interval,
    intervalMs,
    // TODO: the query request expects number and we are using string here. Seems like it works so far but can create
    // issues down the road.
    panelId: panelId as any,
    targets: configuredQueries, // Datasources rely on DataQueries being passed under the targets key.
    range,
    requestId: 'explore',
    rangeRaw: range.raw,
    scopedVars: {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
    },
    maxDataPoints: queryOptions.maxDataPoints,
    exploreMode: queryOptions.mode,
  };

  return {
    queries,
    request,
    scanning,
    id: generateKey(), // reusing for unique ID
    done: false,
    latency: 0,
  };
}

export const clearQueryKeys: (query: DataQuery) => object = ({ key, refId, ...rest }) => rest;

const isSegment = (segment: { [key: string]: string }, ...props: string[]) =>
  props.some(prop => segment.hasOwnProperty(prop));

enum ParseUrlStateIndex {
  RangeFrom = 0,
  RangeTo = 1,
  Datasource = 2,
  SegmentsStart = 3,
}

enum ParseUiStateIndex {
  Graph = 0,
  Logs = 1,
  Table = 2,
  Strategy = 3,
}

export const safeParseJson = (text: string) => {
  if (!text) {
    return;
  }

  try {
    return JSON.parse(decodeURI(text));
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

export function parseUrlState(initial: string | undefined): ExploreUrlState {
  const parsed = safeParseJson(initial);
  const errorResult: any = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
    ui: DEFAULT_UI_STATE,
    mode: null,
    originPanelId: null,
  };

  if (!parsed) {
    return errorResult;
  }

  if (!Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed.length <= ParseUrlStateIndex.SegmentsStart) {
    console.error('Error parsing compact URL state for Explore.');
    return errorResult;
  }

  const range = {
    from: parsed[ParseUrlStateIndex.RangeFrom],
    to: parsed[ParseUrlStateIndex.RangeTo],
  };
  const datasource = parsed[ParseUrlStateIndex.Datasource];
  const parsedSegments = parsed.slice(ParseUrlStateIndex.SegmentsStart);
  const metricProperties = ['expr', 'target', 'datasource', 'query'];
  const queries = parsedSegments.filter(segment => isSegment(segment, ...metricProperties));
  const modeObj = parsedSegments.filter(segment => isSegment(segment, 'mode'))[0];
  const mode = modeObj ? modeObj.mode : ExploreMode.Metrics;

  const uiState = parsedSegments.filter(segment => isSegment(segment, 'ui'))[0];
  const ui = uiState
    ? {
        showingGraph: uiState.ui[ParseUiStateIndex.Graph],
        showingLogs: uiState.ui[ParseUiStateIndex.Logs],
        showingTable: uiState.ui[ParseUiStateIndex.Table],
        dedupStrategy: uiState.ui[ParseUiStateIndex.Strategy],
      }
    : DEFAULT_UI_STATE;

  const originPanelId = parsedSegments.filter(segment => isSegment(segment, 'originPanelId'))[0];
  return { datasource, queries, range, ui, mode, originPanelId };
}

export function serializeStateToUrlParam(urlState: ExploreUrlState, compact?: boolean): string {
  if (compact) {
    return JSON.stringify([
      urlState.range.from,
      urlState.range.to,
      urlState.datasource,
      ...urlState.queries,
      { mode: urlState.mode },
      {
        ui: [
          !!urlState.ui.showingGraph,
          !!urlState.ui.showingLogs,
          !!urlState.ui.showingTable,
          urlState.ui.dedupStrategy,
        ],
      },
    ]);
  }
  return JSON.stringify(urlState);
}

export function generateKey(index = 0): string {
  return `Q-${Date.now()}-${Math.random()}-${index}`;
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
  return [{ ...generateEmptyQuery(queries) }];
}

/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key and context.
 */
const validKeys = ['refId', 'key', 'context'];
export function hasNonEmptyQuery<TQuery extends DataQuery = any>(queries: TQuery[]): boolean {
  return (
    queries &&
    queries.some((query: any) => {
      const keys = Object.keys(query)
        .filter(key => validKeys.indexOf(key) === -1)
        .map(k => query[k])
        .filter(v => v);
      return keys.length > 0;
    })
  );
}

/**
 * Update the query history. Side-effect: store history in local storage
 */
export function updateHistory<T extends DataQuery = any>(
  history: Array<HistoryItem<T>>,
  datasourceId: string,
  queries: T[]
): Array<HistoryItem<T>> {
  const ts = Date.now();
  queries.forEach(query => {
    history = [{ query, ts }, ...history];
  });

  if (history.length > MAX_HISTORY_ITEMS) {
    history = history.slice(0, MAX_HISTORY_ITEMS);
  }

  // Combine all queries of a datasource type into one history
  const historyKey = `grafana.explore.history.${datasourceId}`;
  store.setObject(historyKey, history);
  return history;
}

export function clearHistory(datasourceId: string) {
  const historyKey = `grafana.explore.history.${datasourceId}`;
  store.delete(historyKey);
}

export const getQueryKeys = (queries: DataQuery[], datasourceInstance: DataSourceApi): string[] => {
  const queryKeys = queries.reduce((newQueryKeys, query, index) => {
    const primaryKey = datasourceInstance && datasourceInstance.name ? datasourceInstance.name : query.key;
    return newQueryKeys.concat(`${primaryKey}-${index}`);
  }, []);

  return queryKeys;
};

export const getTimeRange = (timeZone: TimeZone, rawRange: RawTimeRange): TimeRange => {
  return {
    from: dateMath.parse(rawRange.from, false, timeZone as any),
    to: dateMath.parse(rawRange.to, true, timeZone as any),
    raw: rawRange,
  };
};

const parseRawTime = (value: any): TimeFragment => {
  if (value === null) {
    return null;
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

  if (!isNaN(value)) {
    const epoch = parseInt(value, 10);
    return toUtc(epoch);
  }

  return null;
};

export const getTimeRangeFromUrl = (range: RawTimeRange, timeZone: TimeZone): TimeRange => {
  const raw = {
    from: parseRawTime(range.from),
    to: parseRawTime(range.to),
  };

  return {
    from: dateMath.parse(raw.from, false, timeZone as any),
    to: dateMath.parse(raw.to, true, timeZone as any),
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

export const getFirstQueryErrorWithoutRefId = (errors?: DataQueryError[]) => {
  if (!errors) {
    return undefined;
  }

  return errors.filter(error => (error && error.refId ? false : true))[0];
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

  return _.uniq(_.flatten(refIds));
};

export const sortInAscendingOrder = (a: LogRowModel, b: LogRowModel) => {
  if (a.timeEpochMs < b.timeEpochMs) {
    return -1;
  }

  if (a.timeEpochMs > b.timeEpochMs) {
    return 1;
  }

  return 0;
};

const sortInDescendingOrder = (a: LogRowModel, b: LogRowModel) => {
  if (a.timeEpochMs > b.timeEpochMs) {
    return -1;
  }

  if (a.timeEpochMs < b.timeEpochMs) {
    return 1;
  }

  return 0;
};

export enum SortOrder {
  Descending = 'Descending',
  Ascending = 'Ascending',
}

export const refreshIntervalToSortOrder = (refreshInterval?: string) =>
  RefreshPicker.isLive(refreshInterval) ? SortOrder.Ascending : SortOrder.Descending;

export const sortLogsResult = (logsResult: LogsModel, sortOrder: SortOrder): LogsModel => {
  const rows = logsResult ? logsResult.rows : [];
  sortOrder === SortOrder.Ascending ? rows.sort(sortInAscendingOrder) : rows.sort(sortInDescendingOrder);
  const result: LogsModel = logsResult ? { ...logsResult, rows } : { hasUniqueLabels: false, rows };

  return result;
};

export const convertToWebSocketUrl = (url: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
  if (backend.endsWith('/')) {
    backend = backend.slice(0, -1);
  }
  return `${backend}${url}`;
};

export const stopQueryState = (querySubscription: Unsubscribable) => {
  if (querySubscription) {
    querySubscription.unsubscribe();
  }
};

export function getIntervals(range: TimeRange, lowLimit: string, resolution: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return kbn.calculateInterval(range, resolution, lowLimit);
}

export function deduplicateLogRowsById(rows: LogRowModel[]) {
  return _.uniqBy(rows, 'uid');
}
