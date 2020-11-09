import { EventBusExtended, DefaultTimeRange, LoadingState, LogsDedupStrategy, PanelData } from '@grafana/data';

import { ExploreItemState, ExploreUpdateState } from 'app/types/explore';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

export const makeInitialUpdateState = (): ExploreUpdateState => ({
  datasource: false,
  queries: false,
  range: false,
  mode: false,
});

/**
 * Returns a fresh Explore area state
 */
export const makeExplorePaneState = (): ExploreItemState => ({
  containerWidth: 0,
  datasourceInstance: null,
  requestedDatasourceName: null,
  datasourceLoading: null,
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
  urlState: null,
  update: makeInitialUpdateState(),
  latency: 0,
  isLive: false,
  isPaused: false,
  urlReplaced: false,
  queryResponse: createEmptyQueryResponse(),
  tableResult: null,
  graphResult: null,
  logsResult: null,
  dedupStrategy: LogsDedupStrategy.none,
  eventBridge: (null as unknown) as EventBusExtended,
});

export const createEmptyQueryResponse = (): PanelData => ({
  state: LoadingState.NotStarted,
  series: [],
  timeRange: DefaultTimeRange,
});
