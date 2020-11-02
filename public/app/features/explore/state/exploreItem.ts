import { AnyAction } from 'redux';
import { DefaultTimeRange, LoadingState, LogsDedupStrategy, PanelData, sortLogsResult } from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';

import { getQueryKeys, refreshIntervalToSortOrder, stopQueryState } from 'app/core/utils/explore';
import { ExploreItemState, ExploreUpdateState } from 'app/types/explore';
import {
  changeDedupStrategyAction,
  changeLoadingStateAction,
  changeRangeAction,
  changeRefreshIntervalAction,
  changeSizeAction,
  highlightLogsExpressionAction,
  historyUpdatedAction,
  initializeExploreAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  queriesImportedAction,
  scanStartAction,
  scanStopAction,
  setPausedStateAction,
  setUrlReplacedAction,
  toggleLogLevelAction,
  updateDatasourceInstanceAction,
} from './actionTypes';
import { Emitter } from 'app/core/core';
import { queryReducer } from './query';

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
export const makeExploreItemState = (): ExploreItemState => ({
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
  eventBridge: (null as unknown) as Emitter,
});

export const createEmptyQueryResponse = (): PanelData => ({
  state: LoadingState.NotStarted,
  series: [],
  timeRange: DefaultTimeRange,
});

/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
export const initialExploreItemState = makeExploreItemState();

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const itemReducer = (state: ExploreItemState = makeExploreItemState(), action: AnyAction): ExploreItemState => {
  state = queryReducer(state, action);

  if (changeSizeAction.match(action)) {
    const containerWidth = action.payload.width;
    return { ...state, containerWidth };
  }

  if (changeRefreshIntervalAction.match(action)) {
    const { refreshInterval } = action.payload;
    const live = RefreshPicker.isLive(refreshInterval);
    const sortOrder = refreshIntervalToSortOrder(refreshInterval);
    const logsResult = sortLogsResult(state.logsResult, sortOrder);

    if (RefreshPicker.isLive(state.refreshInterval) && !live) {
      stopQueryState(state.querySubscription);
    }

    return {
      ...state,
      refreshInterval,
      queryResponse: {
        ...state.queryResponse,
        state: live ? LoadingState.Streaming : LoadingState.Done,
      },
      isLive: live,
      isPaused: live ? false : state.isPaused,
      loading: live,
      logsResult,
    };
  }

  if (highlightLogsExpressionAction.match(action)) {
    const { expressions } = action.payload;
    return { ...state, logsHighlighterExpressions: expressions };
  }

  if (changeDedupStrategyAction.match(action)) {
    const { dedupStrategy } = action.payload;
    return {
      ...state,
      dedupStrategy,
    };
  }

  if (initializeExploreAction.match(action)) {
    const { containerWidth, eventBridge, queries, range, originPanelId } = action.payload;
    return {
      ...state,
      containerWidth,
      eventBridge,
      range,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries, state.datasourceInstance),
      originPanelId,
      update: makeInitialUpdateState(),
    };
  }

  if (updateDatasourceInstanceAction.match(action)) {
    const { datasourceInstance } = action.payload;

    // Custom components
    stopQueryState(state.querySubscription);

    return {
      ...state,
      datasourceInstance,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      latency: 0,
      queryResponse: createEmptyQueryResponse(),
      loading: false,
      queryKeys: [],
      originPanelId: state.urlState && state.urlState.originPanelId,
    };
  }

  if (loadDatasourceMissingAction.match(action)) {
    return {
      ...state,
      datasourceMissing: true,
      datasourceLoading: false,
      update: makeInitialUpdateState(),
    };
  }

  if (loadDatasourcePendingAction.match(action)) {
    return {
      ...state,
      datasourceLoading: true,
      requestedDatasourceName: action.payload.requestedDatasourceName,
    };
  }

  if (loadDatasourceReadyAction.match(action)) {
    const { history } = action.payload;
    return {
      ...state,
      history,
      datasourceLoading: false,
      datasourceMissing: false,
      logsHighlighterExpressions: undefined,
      update: makeInitialUpdateState(),
    };
  }

  if (scanStartAction.match(action)) {
    return { ...state, scanning: true };
  }

  if (scanStopAction.match(action)) {
    return {
      ...state,
      scanning: false,
      scanRange: undefined,
      update: makeInitialUpdateState(),
    };
  }

  if (queriesImportedAction.match(action)) {
    const { queries } = action.payload;
    return {
      ...state,
      queries,
      queryKeys: getQueryKeys(queries, state.datasourceInstance),
    };
  }

  if (toggleLogLevelAction.match(action)) {
    const { hiddenLogLevels } = action.payload;
    return {
      ...state,
      hiddenLogLevels: Array.from(hiddenLogLevels),
    };
  }

  if (historyUpdatedAction.match(action)) {
    return {
      ...state,
      history: action.payload.history,
    };
  }

  if (setUrlReplacedAction.match(action)) {
    return {
      ...state,
      urlReplaced: true,
    };
  }

  if (changeRangeAction.match(action)) {
    const { range, absoluteRange } = action.payload;
    return {
      ...state,
      range,
      absoluteRange,
      update: makeInitialUpdateState(),
    };
  }

  if (changeLoadingStateAction.match(action)) {
    const { loadingState } = action.payload;
    return {
      ...state,
      queryResponse: {
        ...state.queryResponse,
        state: loadingState,
      },
      loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
    };
  }

  if (setPausedStateAction.match(action)) {
    const { isPaused } = action.payload;
    return {
      ...state,
      isPaused: isPaused,
    };
  }

  return state;
};
