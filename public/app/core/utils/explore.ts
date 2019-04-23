// Libraries
import _ from 'lodash';

// Services & Utils
import * as dateMath from 'app/core/utils/datemath';
import { renderUrl } from 'app/core/utils/url';
import kbn from 'app/core/utils/kbn';
import store from 'app/core/store';
import { parse as parseDate } from 'app/core/utils/datemath';
import { colors } from '@grafana/ui';
import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';
import { getNextRefIdChar } from './query';

// Types
import { RawTimeRange, IntervalValues, DataQuery, DataSourceApi } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';
import {
  ExploreUrlState,
  HistoryItem,
  QueryTransaction,
  ResultType,
  QueryIntervals,
  QueryOptions,
  ResultGetter,
} from 'app/types/explore';
import { LogsDedupStrategy } from 'app/core/logs_model';

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
  query: DataQuery,
  rowIndex: number,
  resultType: ResultType,
  queryOptions: QueryOptions,
  range: RawTimeRange,
  queryIntervals: QueryIntervals,
  scanning: boolean
): QueryTransaction {
  const { interval, intervalMs } = queryIntervals;

  const configuredQueries = [
    {
      ...query,
      ...queryOptions,
    },
  ];

  // Clone range for query request
  // const queryRange: RawTimeRange = { ...range };
  // const { from, to, raw } = this.timeSrv.timeRange();
  // Most datasource is using `panelId + query.refId` for cancellation logic.
  // Using `format` here because it relates to the view panel that the request is for.
  // However, some datasources don't use `panelId + query.refId`, but only `panelId`.
  // Therefore panel id has to be unique.
  const panelId = `${queryOptions.format}-${query.key}`;

  const options = {
    interval,
    intervalMs,
    panelId,
    targets: configuredQueries, // Datasources rely on DataQueries being passed under the targets key.
    range: {
      from: dateMath.parse(range.from, false),
      to: dateMath.parse(range.to, true),
      raw: range,
    },
    rangeRaw: range,
    scopedVars: {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
    },
    maxDataPoints: queryOptions.maxDataPoints,
  };

  return {
    options,
    query,
    resultType,
    rowIndex,
    scanning,
    id: generateKey(), // reusing for unique ID
    done: false,
    latency: 0,
  };
}

export const clearQueryKeys: (query: DataQuery) => object = ({ key, refId, ...rest }) => rest;

const metricProperties = ['expr', 'target', 'datasource'];
const isMetricSegment = (segment: { [key: string]: string }) =>
  metricProperties.some(prop => segment.hasOwnProperty(prop));
const isUISegment = (segment: { [key: string]: string }) => segment.hasOwnProperty('ui');

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

export function parseUrlState(initial: string | undefined): ExploreUrlState {
  const parsed = safeParseJson(initial);
  const errorResult = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
    ui: DEFAULT_UI_STATE,
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
  const uiState = parsedSegments.filter(segment => isUISegment(segment))[0];
  const ui = uiState
    ? {
        showingGraph: uiState.ui[ParseUiStateIndex.Graph],
        showingLogs: uiState.ui[ParseUiStateIndex.Logs],
        showingTable: uiState.ui[ParseUiStateIndex.Table],
        dedupStrategy: uiState.ui[ParseUiStateIndex.Strategy],
      }
    : DEFAULT_UI_STATE;

  return { datasource, queries, range, ui };
}

export function serializeStateToUrlParam(urlState: ExploreUrlState, compact?: boolean): string {
  if (compact) {
    return JSON.stringify([
      urlState.range.from,
      urlState.range.to,
      urlState.datasource,
      ...urlState.queries,
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

/**
 * Ensure at least one target exists and that targets have the necessary keys
 */
export function ensureQueries(queries?: DataQuery[]): DataQuery[] {
  if (queries && typeof queries === 'object' && queries.length > 0) {
    return queries.map((query, i) => ({ ...query, ...generateEmptyQuery(queries, i) }));
  }
  return [{ ...generateEmptyQuery(queries) }];
}

/**
 * A target is non-empty when it has keys (with non-empty values) other than refId and key.
 */
export function hasNonEmptyQuery<TQuery extends DataQuery = any>(queries: TQuery[]): boolean {
  return (
    queries &&
    queries.some(
      query =>
        Object.keys(query)
          .map(k => query[k])
          .filter(v => v).length > 2
    )
  );
}

export function calculateResultsFromQueryTransactions(
  queryTransactions: QueryTransaction[],
  datasource: any,
  graphInterval: number
) {
  const graphResult = _.flatten(
    queryTransactions.filter(qt => qt.resultType === 'Graph' && qt.done && qt.result).map(qt => qt.result)
  );
  const tableResult = mergeTablesIntoModel(
    new TableModel(),
    ...queryTransactions
      .filter(qt => qt.resultType === 'Table' && qt.done && qt.result && qt.result.columns && qt.result.rows)
      .map(qt => qt.result)
  );
  const logsResult =
    datasource && datasource.mergeStreams
      ? datasource.mergeStreams(
          _.flatten(
            queryTransactions.filter(qt => qt.resultType === 'Logs' && qt.done && qt.result).map(qt => qt.result)
          ),
          graphInterval
        )
      : undefined;

  return {
    graphResult,
    tableResult,
    logsResult,
  };
}

export function getIntervals(range: RawTimeRange, lowLimit: string, resolution: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  const absoluteRange: RawTimeRange = {
    from: parseDate(range.from, false),
    to: parseDate(range.to, true),
  };

  return kbn.calculateInterval(absoluteRange, resolution, lowLimit);
}

export const makeTimeSeriesList: ResultGetter = (dataList, transaction, allTransactions) => {
  // Prevent multiple Graph transactions to have the same colors
  let colorIndexOffset = 0;
  for (const other of allTransactions) {
    // Only need to consider transactions that came before the current one
    if (other === transaction) {
      break;
    }
    // Count timeseries of previous query results
    if (other.resultType === 'Graph' && other.done) {
      colorIndexOffset += other.result.length;
    }
  }

  return dataList.map((seriesData, index: number) => {
    const datapoints = seriesData.datapoints || [];
    const alias = seriesData.target;
    const colorIndex = (colorIndexOffset + index) % colors.length;
    const color = colors[colorIndex];

    const series = new TimeSeries({
      datapoints,
      alias,
      color,
      unit: seriesData.unit,
    });

    return series;
  });
};

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
