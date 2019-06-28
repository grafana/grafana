// Libraries
import _ from 'lodash';
import { from } from 'rxjs';
import { toUtc } from '@grafana/ui/src/utils/moment_wrapper';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

// Services & Utils
import * as dateMath from '@grafana/ui/src/utils/datemath';
import { renderUrl } from 'app/core/utils/url';
import kbn from 'app/core/utils/kbn';
import store from 'app/core/store';
import { getNextRefIdChar } from './query';

// Types
import {
  TimeRange,
  RawTimeRange,
  TimeZone,
  IntervalValues,
  DataQuery,
  DataSourceApi,
  TimeFragment,
  DataQueryError,
  LogRowModel,
  LogsModel,
  LogsDedupStrategy,
  DataSourceJsonData,
  DataQueryRequest,
  DataStreamObserver,
} from '@grafana/ui';
import {
  ExploreUrlState,
  HistoryItem,
  QueryTransaction,
  QueryIntervals,
  QueryOptions,
  ExploreMode,
} from 'app/types/explore';
import { config } from '../config';

export const DEFAULT_RANGE = {
  from: 'now-6h',
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

/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 *
 * @param panel Origin panel of the jump to Explore
 * @param panelTargets The origin panel's query targets
 * @param panelDatasource The origin panel's datasource
 * @param datasourceSrv Datasource service to query other datasources in case the panel datasource is mixed
 * @param timeSrv Time service to get the current dashboard range from
 */
export async function getExploreUrl(
  panel: any,
  panelTargets: any[],
  panelDatasource: any,
  datasourceSrv: any,
  timeSrv: any
) {
  let exploreDatasource = panelDatasource;
  let exploreTargets: DataQuery[] = panelTargets;
  let url: string;

  // Mixed datasources need to choose only one datasource
  if (panelDatasource.meta.id === 'mixed' && panelTargets) {
    // Find first explore datasource among targets
    let mixedExploreDatasource;
    for (const t of panel.targets) {
      const datasource = await datasourceSrv.get(t.datasource);
      if (datasource && datasource.meta.explore) {
        mixedExploreDatasource = datasource;
        break;
      }
    }

    // Add all its targets
    if (mixedExploreDatasource) {
      exploreDatasource = mixedExploreDatasource;
      exploreTargets = panelTargets.filter(t => t.datasource === mixedExploreDatasource.name);
    }
  }

  if (panelDatasource) {
    const range = timeSrv.timeRangeForUrl();
    let state: Partial<ExploreUrlState> = { range };
    if (exploreDatasource.getExploreState) {
      state = { ...state, ...exploreDatasource.getExploreState(exploreTargets) };
    } else {
      state = {
        ...state,
        datasource: panelDatasource.name,
        queries: exploreTargets.map(t => ({ ...t, datasource: panelDatasource.name })),
      };
    }

    const exploreState = JSON.stringify(state);
    url = renderUrl('/explore', { left: exploreState });
  }
  return url;
}

export function buildQueryTransaction(
  queries: DataQuery[],
  queryOptions: QueryOptions,
  range: TimeRange,
  queryIntervals: QueryIntervals,
  scanning: boolean
): QueryTransaction {
  const { interval, intervalMs } = queryIntervals;

  const configuredQueries = queries.map(query => ({ ...query, ...queryOptions }));
  const key = queries.reduce((combinedKey, query) => {
    combinedKey += query.key;
    return combinedKey;
  }, '');

  // Clone range for query request
  // const queryRange: RawTimeRange = { ...range };
  // const { from, to, raw } = this.timeSrv.timeRange();
  // Most datasource is using `panelId + query.refId` for cancellation logic.
  // Using `format` here because it relates to the view panel that the request is for.
  // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
  // Therefore panel id has to be unique.
  const panelId = `${key}`;

  const options = {
    interval,
    intervalMs,
    panelId,
    targets: configuredQueries, // Datasources rely on DataQueries being passed under the targets key.
    range,
    rangeRaw: range.raw,
    scopedVars: {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
    },
    maxDataPoints: queryOptions.maxDataPoints,
  };

  return {
    queries,
    options,
    scanning,
    id: generateKey(), // reusing for unique ID
    done: false,
    latency: 0,
  };
}

export const clearQueryKeys: (query: DataQuery) => object = ({ key, refId, ...rest }) => rest;

const metricProperties = ['expr', 'target', 'datasource', 'query'];
const isMetricSegment = (segment: { [key: string]: string }) =>
  metricProperties.some(prop => segment.hasOwnProperty(prop));
const isUISegment = (segment: { [key: string]: string }) => segment.hasOwnProperty('ui');
const isModeSegment = (segment: { [key: string]: string }) => segment.hasOwnProperty('mode');

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
  const errorResult = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
    ui: DEFAULT_UI_STATE,
    mode: null,
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
  const queries = parsedSegments.filter(segment => isMetricSegment(segment));
  const modeObj = parsedSegments.filter(segment => isModeSegment(segment))[0];
  const mode = modeObj ? modeObj.mode : ExploreMode.Metrics;

  const uiState = parsedSegments.filter(segment => isUISegment(segment))[0];
  const ui = uiState
    ? {
        showingGraph: uiState.ui[ParseUiStateIndex.Graph],
        showingLogs: uiState.ui[ParseUiStateIndex.Logs],
        showingTable: uiState.ui[ParseUiStateIndex.Table],
        dedupStrategy: uiState.ui[ParseUiStateIndex.Strategy],
      }
    : DEFAULT_UI_STATE;

  return { datasource, queries, range, ui, mode };
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
    queries.some(query => {
      const keys = Object.keys(query)
        .filter(key => validKeys.indexOf(key) === -1)
        .map(k => query[k])
        .filter(v => v);
      return keys.length > 0;
    })
  );
}

export function getIntervals(range: TimeRange, lowLimit: string, resolution: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return kbn.calculateInterval(range, resolution, lowLimit);
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

const parseRawTime = (value): TimeFragment => {
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

export const instanceOfDataQueryError = (value: any): value is DataQueryError => {
  return value.message !== undefined && value.status !== undefined && value.statusText !== undefined;
};

export const getValueWithRefId = (value: any): any | null => {
  if (!value) {
    return null;
  }

  if (typeof value !== 'object') {
    return null;
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

  return null;
};

export const getFirstQueryErrorWithoutRefId = (errors: DataQueryError[]) => {
  if (!errors) {
    return null;
  }

  return errors.filter(error => (error.refId ? false : true))[0];
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

const sortInAscendingOrder = (a: LogRowModel, b: LogRowModel) => {
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

export const sortLogsResult = (logsResult: LogsModel, refreshInterval: string) => {
  const rows = logsResult ? logsResult.rows : [];
  const live = isLive(refreshInterval);
  live ? rows.sort(sortInAscendingOrder) : rows.sort(sortInDescendingOrder);
  const result: LogsModel = logsResult ? { ...logsResult, rows } : { hasUniqueLabels: false, rows };

  return result;
};

export const convertToWebSocketUrl = (url: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
  if (backend.endsWith('/')) {
    backend = backend.slice(0, backend.length - 1);
  }
  return `${backend}${url}`;
};

export const getQueryResponse = (
  datasourceInstance: DataSourceApi<DataQuery, DataSourceJsonData>,
  options: DataQueryRequest<DataQuery>,
  observer?: DataStreamObserver
) => {
  return from(datasourceInstance.query(options, observer));
};
