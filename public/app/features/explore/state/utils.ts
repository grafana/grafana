import {
  AbsoluteTimeRange,
  DataSourceApi,
  EventBusExtended,
  getDefaultTimeRange,
  HistoryItem,
  LoadingState,
  PanelData,
  RawTimeRange,
  TimeFragment,
  TimeRange,
  dateMath,
  DateTime,
  isDateTime,
  toUtc,
} from '@grafana/data';
import { DataSourceRef, TimeZone } from '@grafana/schema';
import { ExplorePanelData } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import store from '../../../core/store';
import { lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { loadSupplementaryQueries } from '../utils/supplementaryQueries';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

const GRAPH_STYLE_KEY = 'grafana.explore.style.graph';
export const storeGraphStyle = (graphStyle: string): void => {
  store.set(GRAPH_STYLE_KEY, graphStyle);
};

/**
 * Returns a fresh Explore area state
 */
export const makeExplorePaneState = (): ExploreItemState => ({
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
  loading: false,
  queryKeys: [],
  isLive: false,
  isPaused: false,
  queryResponse: createEmptyQueryResponse(),
  tableResult: null,
  graphResult: null,
  logsResult: null,
  rawPrometheusResult: null,
  eventBridge: null as unknown as EventBusExtended,
  cache: [],
  richHistory: [],
  supplementaryQueries: loadSupplementaryQueries(),
  panelsState: {},
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
  let instance;
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

  const historyKey = `grafana.explore.history.${instance.meta?.id}`;
  const history = store.getObject<HistoryItem[]>(historyKey, []);
  // Save last-used datasource

  store.set(lastUsedDatasourceKeyForOrgId(orgId), instance.uid);
  return { history, instance };
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

export function getRange(range: RawTimeRange, timeZone: TimeZone): TimeRange {
  const raw = {
    from: parseRawTime(range.from)!,
    to: parseRawTime(range.to)!,
  };

  return {
    from: dateMath.parse(raw.from, false, timeZone as any)!,
    to: dateMath.parse(raw.to, true, timeZone as any)!,
    raw,
  };
}

function parseRawTime(value: string | DateTime): TimeFragment | null {
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
}
