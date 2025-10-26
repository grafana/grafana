import { uniq } from 'lodash';

import {
  AbsoluteTimeRange,
  DataSourceApi,
  dateMath,
  DateTime,
  EventBusExtended,
  getDefaultTimeRange,
  HistoryItem,
  isDateTime,
  LoadingState,
  LogRowModel,
  PanelData,
  RawTimeRange,
  ScopedVars,
  TimeFragment,
  TimeRange,
  toUtc,
  URLRange,
  URLRangeValue,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceJsonData, DataSourceRef, TimeZone } from '@grafana/schema';
import { getLocalRichHistoryStorage } from 'app/core/history/richHistoryStorageProvider';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExploreItemState, ExplorePanelData, RichHistoryQuery } from 'app/types/explore';
import { StoreState } from 'app/types/store';

import store from '../../../core/store';
import { setLastUsedDatasourceUID } from '../../../core/utils/explore';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { loadSupplementaryQueries } from '../utils/supplementaryQueries';

import { DEFAULT_RANGE } from './constants';

export const MAX_HISTORY_AUTOCOMPLETE_ITEMS = 100;

const GRAPH_STYLE_KEY = 'grafana.explore.style.graph';
export const storeGraphStyle = (graphStyle: string): void => {
  store.set(GRAPH_STYLE_KEY, graphStyle);
};

/**
 * Returns a fresh Explore area state
 */
export const makeExplorePaneState = (overrides?: Partial<ExploreItemState>): ExploreItemState => ({
  containerWidth: 0,
  datasourceInstance: null,
  history: [],
  queries: [],
  initialized: false,
  range: {
    from: null,
    to: null,
    raw: DEFAULT_RANGE,
  } as any,
  absoluteRange: {
    from: null,
    to: null,
  } as any,
  scanning: false,
  queryKeys: [],
  isLive: false,
  isPaused: false,
  queryResponse: createEmptyQueryResponse(),
  tableResult: null,
  graphResult: null,
  logsResult: null,
  clearedAtIndex: null,
  rawPrometheusResult: null,
  eventBridge: null as unknown as EventBusExtended,
  cache: [],
  supplementaryQueries: loadSupplementaryQueries(),
  panelsState: {},
  correlations: undefined,
  compact: false,
  ...overrides,
});

export const createEmptyQueryResponse = (): ExplorePanelData => ({
  state: LoadingState.NotStarted,
  series: [],
  timeRange: getDefaultTimeRange(),
  graphFrames: [],
  logsFrames: [],
  traceFrames: [],
  nodeGraphFrames: [],
  flameGraphFrames: [],
  customFrames: [],
  tableFrames: [],
  rawPrometheusFrames: [],
  rawPrometheusResult: null,
  graphResult: null,
  logsResult: null,
  tableResult: null,
});

export async function loadAndInitDatasource(
  orgId: number,
  datasource: DataSourceRef | string
): Promise<{ history: HistoryItem[]; instance: DataSourceApi }> {
  let instance: DataSourceApi<DataQuery, DataSourceJsonData, {}>;
  try {
    // let datasource be a ref if we have the info, otherwise a name or uid will do for lookup
    instance = await getDatasourceSrv().get(datasource);
  } catch (error) {
    // Falling back to the default data source in case the provided data source was not found.
    // It may happen if last used data source or the data source provided in the URL has been
    // removed or it is not provisioned anymore.
    instance = await getDatasourceSrv().get();
  }
  if (instance.init) {
    try {
      instance.init();
    } catch (err) {
      // TODO: should probably be handled better
      console.error(err);
    }
  }

  let history: HistoryItem[] = [];

  const localStorageHistory = getLocalRichHistoryStorage();

  const historyResults = await localStorageHistory.getRichHistory({
    search: '',
    sortOrder: SortOrder.Ascending,
    datasourceFilters: [instance.name],
    starred: false,
  });

  // first, fill autocomplete with query history for that datasource
  if ((historyResults.total || 0) > 0) {
    historyResults.richHistory.forEach((historyResult: RichHistoryQuery) => {
      historyResult.queries.forEach((q) => {
        history.push({ ts: parseInt(historyResult.id, 10), query: q });
      });
    });
  }

  if (history.length < MAX_HISTORY_AUTOCOMPLETE_ITEMS) {
    // check the last 100 mixed history results seperately
    const historyMixedResults = await localStorageHistory.getRichHistory({
      search: '',
      sortOrder: SortOrder.Ascending,
      datasourceFilters: [MIXED_DATASOURCE_NAME],
      starred: false,
    });

    if ((historyMixedResults.total || 0) > 0) {
      // second, fill autocomplete with queries for that datasource used in Mixed scenarios
      historyMixedResults.richHistory.forEach((historyResult: RichHistoryQuery) => {
        historyResult.queries.forEach((q) => {
          if (q?.datasource?.uid === instance.uid) {
            history.push({ ts: parseInt(historyResult.id, 10), query: q });
          }
        });
      });
    }
  }

  // finally, add any legacy local storage history that might exist. To be removed in Grafana 12 #83309
  if (history.length < MAX_HISTORY_AUTOCOMPLETE_ITEMS) {
    const historyKey = `grafana.explore.history.${instance.meta?.id}`;
    history = [...history, ...store.getObject<HistoryItem[]>(historyKey, [])];
  }

  if (history.length > MAX_HISTORY_AUTOCOMPLETE_ITEMS) {
    history.length = MAX_HISTORY_AUTOCOMPLETE_ITEMS;
  }

  // Save last-used datasource
  setLastUsedDatasourceUID(orgId, instance.uid);
  return { history: history, instance };
}

export function createCacheKey(absRange: AbsoluteTimeRange) {
  const params = {
    from: absRange.from,
    to: absRange.to,
  };

  const cacheKey = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v.toString())}`)
    .join('&');
  return cacheKey;
}

export function getResultsFromCache(
  cache: Array<{ key: string; value: PanelData }>,
  absoluteRange: AbsoluteTimeRange
): PanelData | undefined {
  const cacheKey = createCacheKey(absoluteRange);
  const cacheIdx = cache.findIndex((c) => c.key === cacheKey);
  const cacheValue = cacheIdx >= 0 ? cache[cacheIdx].value : undefined;
  return cacheValue;
}

export function getRange(raw: RawTimeRange, timeZone: TimeZone): TimeRange {
  return {
    from: dateMath.parse(raw.from, false, timeZone)!,
    to: dateMath.parse(raw.to, true, timeZone)!,
    raw,
  };
}

export function fromURLRange(range: URLRange): RawTimeRange {
  let rawTimeRange: RawTimeRange = DEFAULT_RANGE;
  let parsedRange = {
    from: parseRawTime(range.from),
    to: parseRawTime(range.to),
  };
  if (parsedRange.from !== null && parsedRange.to !== null) {
    rawTimeRange = { from: parsedRange.from, to: parsedRange.to };
  }
  return rawTimeRange;
}

function parseRawTime(urlRangeValue: URLRangeValue | DateTime): TimeFragment | null {
  if (urlRangeValue === null) {
    return null;
  }

  if (isDateTime(urlRangeValue)) {
    return urlRangeValue;
  }

  if (typeof urlRangeValue !== 'string') {
    return null;
  }

  // it can only be a string now
  const value = urlRangeValue;

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
}

export const filterLogRowsByIndex = (
  clearedAtIndex: ExploreItemState['clearedAtIndex'],
  logRows?: LogRowModel[]
): LogRowModel[] => {
  if (!logRows) {
    return [];
  }

  if (clearedAtIndex) {
    const filteredRows = logRows.slice(clearedAtIndex + 1);
    return filteredRows;
  }

  return logRows;
};

export const getDatasourceUIDs = (datasourceUID: string, queries: DataQuery[]): string[] => {
  if (datasourceUID === MIXED_DATASOURCE_NAME) {
    return uniq(queries.map((query) => query.datasource?.uid).filter((uid): uid is string => !!uid));
  } else {
    return [datasourceUID];
  }
};

export async function getCorrelationsData(state: StoreState, exploreId: string) {
  const correlationEditorHelperData = state.explore.panes[exploreId]!.correlationEditorHelperData;

  const isCorrelationEditorMode = state.explore.correlationEditorDetails?.editorMode || false;
  const isLeftPane = Object.keys(state.explore.panes)[0] === exploreId;
  const showCorrelationEditorLinks = isCorrelationEditorMode && isLeftPane;
  const defaultCorrelationEditorDatasource = showCorrelationEditorLinks ? await getDataSourceSrv().get() : undefined;
  const interpolateCorrelationHelperVars =
    isCorrelationEditorMode && !isLeftPane && correlationEditorHelperData !== undefined;

  let scopedVars: ScopedVars = {};
  if (interpolateCorrelationHelperVars && correlationEditorHelperData !== undefined) {
    Object.entries(correlationEditorHelperData?.vars).forEach((variable) => {
      scopedVars[variable[0]] = { value: variable[1] };
    });
  }

  return { defaultCorrelationEditorDatasource, scopedVars, showCorrelationEditorLinks };
}
