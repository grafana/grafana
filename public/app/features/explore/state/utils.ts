import { isEmpty, isObject, mapValues, omitBy } from 'lodash';

import {
  AbsoluteTimeRange,
  DataSourceApi,
  EventBusExtended,
  ExploreUrlState,
  getDefaultTimeRange,
  HistoryItem,
  LoadingState,
  LogRowModel,
  PanelData,
} from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { ExplorePanelData } from 'app/types';
import { ExploreItemState } from 'app/types/explore';

import store from '../../../core/store';
import { clearQueryKeys, lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { loadSupplementaryQueries } from '../utils/supplementaryQueries';
import { toRawTimeRange } from '../utils/time';

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
  datasourceMissing: false,
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
  clearedAtIndex: null,
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

// recursively walks an object, removing keys where the value is undefined
// if the resulting object is empty, returns undefined
function pruneObject(obj: object): object | undefined {
  let pruned = mapValues(obj, (value) => (isObject(value) ? pruneObject(value) : value));
  pruned = omitBy<typeof pruned>(pruned, isEmpty);
  if (isEmpty(pruned)) {
    return undefined;
  }
  return pruned;
}

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.uid || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toRawTimeRange(pane.range),
    // don't include panelsState in the url unless a piece of state is actually set
    panelsState: pruneObject(pane.panelsState),
  };
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
