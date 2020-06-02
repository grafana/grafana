import _ from 'lodash';
import { AnyAction } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';
import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DefaultTimeRange,
  LoadingState,
  PanelData,
  PanelEvents,
  TimeZone,
  toLegacyResponseData,
  ExploreMode,
} from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';
import { LocationUpdate } from '@grafana/runtime';

import {
  DEFAULT_UI_STATE,
  ensureQueries,
  generateNewKeyAndAddRefIdIfMissing,
  getQueryKeys,
  parseUrlState,
  refreshIntervalToSortOrder,
  sortLogsResult,
  stopQueryState,
} from 'app/core/utils/explore';
import { ExploreId, ExploreItemState, ExploreState, ExploreUpdateState } from 'app/types/explore';
import {
  addQueryRowAction,
  changeLoadingStateAction,
  changeModeAction,
  changeQueryAction,
  changeRangeAction,
  changeRefreshIntervalAction,
  changeSizeAction,
  clearQueriesAction,
  highlightLogsExpressionAction,
  historyUpdatedAction,
  richHistoryUpdatedAction,
  initializeExploreAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  modifyQueriesAction,
  queriesImportedAction,
  QueryEndedPayload,
  queryStoreSubscriptionAction,
  queryStreamUpdatedAction,
  removeQueryRowAction,
  resetExploreAction,
  ResetExplorePayload,
  scanStartAction,
  scanStopAction,
  setPausedStateAction,
  setQueriesAction,
  setUrlReplacedAction,
  splitCloseAction,
  SplitCloseActionPayload,
  splitOpenAction,
  syncTimesAction,
  toggleGraphAction,
  toggleLogLevelAction,
  toggleTableAction,
  updateDatasourceInstanceAction,
  updateUIStateAction,
  cancelQueriesAction,
} from './actionTypes';
import { ResultProcessor } from '../utils/ResultProcessor';
import { updateLocation } from '../../../core/actions';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

export const makeInitialUpdateState = (): ExploreUpdateState => ({
  datasource: false,
  queries: false,
  range: false,
  mode: false,
  ui: false,
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
  },
  absoluteRange: {
    from: null,
    to: null,
  },
  scanning: false,
  scanRange: null,
  showingGraph: true,
  showingTable: true,
  loading: false,
  queryKeys: [],
  urlState: null,
  update: makeInitialUpdateState(),
  latency: 0,
  supportedModes: [],
  mode: null,
  isLive: false,
  isPaused: false,
  urlReplaced: false,
  queryResponse: createEmptyQueryResponse(),
});

export const createEmptyQueryResponse = (): PanelData => ({
  state: LoadingState.NotStarted,
  request: {} as DataQueryRequest<DataQuery>,
  series: [],
  error: null,
  timeRange: DefaultTimeRange,
});

/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
export const initialExploreItemState = makeExploreItemState();
export const initialExploreState: ExploreState = {
  split: false,
  syncedTimes: false,
  left: initialExploreItemState,
  right: initialExploreItemState,
  richHistory: [],
};

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const itemReducer = (state: ExploreItemState = makeExploreItemState(), action: AnyAction): ExploreItemState => {
  if (addQueryRowAction.match(action)) {
    const { queries } = state;
    const { index, query } = action.payload;

    // Add to queries, which will cause a new row to be rendered
    const nextQueries = [...queries.slice(0, index + 1), { ...query }, ...queries.slice(index + 1)];

    return {
      ...state,
      queries: nextQueries,
      logsHighlighterExpressions: undefined,
      queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
    };
  }

  if (changeQueryAction.match(action)) {
    const { queries } = state;
    const { query, index } = action.payload;

    // Override path: queries are completely reset
    const nextQuery: DataQuery = generateNewKeyAndAddRefIdIfMissing(query, queries, index);
    const nextQueries = [...queries];
    nextQueries[index] = nextQuery;

    return {
      ...state,
      queries: nextQueries,
      queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
    };
  }

  if (changeSizeAction.match(action)) {
    const containerWidth = action.payload.width;
    return { ...state, containerWidth };
  }

  if (changeModeAction.match(action)) {
    return {
      ...state,
      mode: action.payload.mode,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      queryResponse: createEmptyQueryResponse(),
      loading: false,
    };
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

  if (clearQueriesAction.match(action)) {
    const queries = ensureQueries();
    stopQueryState(state.querySubscription);
    return {
      ...state,
      queries: queries.slice(),
      graphResult: null,
      tableResult: null,
      logsResult: null,
      queryKeys: getQueryKeys(queries, state.datasourceInstance),
      queryResponse: createEmptyQueryResponse(),
      loading: false,
    };
  }

  if (cancelQueriesAction.match(action)) {
    stopQueryState(state.querySubscription);

    return {
      ...state,
      loading: false,
    };
  }

  if (highlightLogsExpressionAction.match(action)) {
    const { expressions } = action.payload;
    return { ...state, logsHighlighterExpressions: expressions };
  }

  if (initializeExploreAction.match(action)) {
    const { containerWidth, eventBridge, queries, range, mode, ui, originPanelId } = action.payload;
    return {
      ...state,
      containerWidth,
      eventBridge,
      range,
      mode,
      queries,
      initialized: true,
      queryKeys: getQueryKeys(queries, state.datasourceInstance),
      ...ui,
      originPanelId,
      update: makeInitialUpdateState(),
    };
  }

  if (updateDatasourceInstanceAction.match(action)) {
    const { datasourceInstance, version, mode } = action.payload;

    // Custom components
    stopQueryState(state.querySubscription);

    let newMetadata = datasourceInstance.meta;

    // HACK: Temporary hack for Loki datasource. Can remove when plugin.json structure is changed.
    if (version && version.length && datasourceInstance.meta.name === 'Loki') {
      const lokiVersionMetadata: Record<string, { metrics: boolean }> = {
        v0: {
          metrics: false,
        },

        v1: {
          metrics: true,
        },
      };
      newMetadata = { ...newMetadata, ...lokiVersionMetadata[version] };
    }

    const updatedDatasourceInstance = Object.assign(datasourceInstance, { meta: newMetadata });
    const [supportedModes, newMode] = getModesForDatasource(updatedDatasourceInstance, state.mode);

    return {
      ...state,
      datasourceInstance: updatedDatasourceInstance,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      latency: 0,
      queryResponse: createEmptyQueryResponse(),
      loading: false,
      queryKeys: [],
      supportedModes,
      mode: mode ?? newMode,
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

  if (modifyQueriesAction.match(action)) {
    const { queries } = state;
    const { modification, index, modifier } = action.payload;
    let nextQueries: DataQuery[];
    if (index === undefined) {
      // Modify all queries
      nextQueries = queries.map((query, i) => {
        const nextQuery = modifier({ ...query }, modification);
        return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries, i);
      });
    } else {
      // Modify query only at index
      nextQueries = queries.map((query, i) => {
        if (i === index) {
          const nextQuery = modifier({ ...query }, modification);
          return generateNewKeyAndAddRefIdIfMissing(nextQuery, queries, i);
        }

        return query;
      });
    }
    return {
      ...state,
      queries: nextQueries,
      queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
    };
  }

  if (removeQueryRowAction.match(action)) {
    const { queries, queryKeys } = state;
    const { index } = action.payload;

    if (queries.length <= 1) {
      return state;
    }

    const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
    const nextQueryKeys = [...queryKeys.slice(0, index), ...queryKeys.slice(index + 1)];

    return {
      ...state,
      queries: nextQueries,
      logsHighlighterExpressions: undefined,
      queryKeys: nextQueryKeys,
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

  if (setQueriesAction.match(action)) {
    const { queries } = action.payload;
    return {
      ...state,
      queries: queries.slice(),
      queryKeys: getQueryKeys(queries, state.datasourceInstance),
    };
  }

  if (updateUIStateAction.match(action)) {
    return { ...state, ...action.payload };
  }

  if (toggleGraphAction.match(action)) {
    const showingGraph = !state.showingGraph;
    if (showingGraph) {
      return { ...state, showingGraph };
    }

    return { ...state, showingGraph, graphResult: null };
  }

  if (toggleTableAction.match(action)) {
    const showingTable = !state.showingTable;
    if (showingTable) {
      return { ...state, showingTable };
    }

    return { ...state, showingTable, tableResult: null };
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

  if (queryStoreSubscriptionAction.match(action)) {
    const { querySubscription } = action.payload;
    return {
      ...state,
      querySubscription,
    };
  }

  if (queryStreamUpdatedAction.match(action)) {
    return processQueryResponse(state, action);
  }

  return state;
};

export const processQueryResponse = (
  state: ExploreItemState,
  action: PayloadAction<QueryEndedPayload>
): ExploreItemState => {
  const { response } = action.payload;
  const { request, state: loadingState, series, error } = response;

  if (error) {
    if (error.cancelled) {
      return state;
    }

    // For Angular editors
    state.eventBridge.emit(PanelEvents.dataError, error);

    return {
      ...state,
      loading: false,
      queryResponse: response,
      graphResult: null,
      tableResult: null,
      logsResult: null,
      update: makeInitialUpdateState(),
    };
  }

  const latency = request.endTime ? request.endTime - request.startTime : 0;
  const processor = new ResultProcessor(state, series, request.intervalMs, request.timezone as TimeZone);
  const graphResult = processor.getGraphResult();
  const tableResult = processor.getTableResult();
  const logsResult = processor.getLogsResult();

  // Send legacy data to Angular editors
  if (state.datasourceInstance.components.QueryCtrl) {
    const legacy = series.map(v => toLegacyResponseData(v));

    state.eventBridge.emit(PanelEvents.dataReceived, legacy);
  }

  return {
    ...state,
    latency,
    queryResponse: response,
    graphResult,
    tableResult,
    logsResult,
    loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
    update: makeInitialUpdateState(),
  };
};

export const updateChildRefreshState = (
  state: Readonly<ExploreItemState>,
  payload: LocationUpdate,
  exploreId: ExploreId
): ExploreItemState => {
  const path = payload.path || '';
  const queryState = payload.query[exploreId] as string;
  if (!queryState) {
    return state;
  }

  const urlState = parseUrlState(queryState);
  if (!state.urlState || path !== '/explore') {
    // we only want to refresh when browser back/forward
    return {
      ...state,
      urlState,
      update: { datasource: false, queries: false, range: false, mode: false, ui: false },
    };
  }

  const datasource = _.isEqual(urlState ? urlState.datasource : '', state.urlState.datasource) === false;
  const queries = _.isEqual(urlState ? urlState.queries : [], state.urlState.queries) === false;
  const range = _.isEqual(urlState ? urlState.range : DEFAULT_RANGE, state.urlState.range) === false;
  const mode = _.isEqual(urlState ? urlState.mode : ExploreMode.Metrics, state.urlState.mode) === false;
  const ui = _.isEqual(urlState ? urlState.ui : DEFAULT_UI_STATE, state.urlState.ui) === false;

  return {
    ...state,
    urlState,
    update: {
      ...state.update,
      datasource,
      queries,
      range,
      mode,
      ui,
    },
  };
};

const getModesForDatasource = (dataSource: DataSourceApi, currentMode: ExploreMode): [ExploreMode[], ExploreMode] => {
  const supportsGraph = dataSource.meta.metrics;
  const supportsLogs = dataSource.meta.logs;
  const supportsTracing = dataSource.meta.tracing;

  let mode = currentMode || ExploreMode.Metrics;
  const supportedModes: ExploreMode[] = [];

  if (supportsGraph) {
    supportedModes.push(ExploreMode.Metrics);
  }

  if (supportsLogs) {
    supportedModes.push(ExploreMode.Logs);
  }

  if (supportsTracing) {
    supportedModes.push(ExploreMode.Tracing);
  }

  if (supportedModes.length === 1) {
    mode = supportedModes[0];
  }

  // HACK: Used to set Loki's default explore mode to Logs mode.
  // A better solution would be to introduce a "default" or "preferred" mode to the datasource config
  if (dataSource.meta.name === 'Loki' && (!currentMode || supportedModes.indexOf(currentMode) === -1)) {
    mode = ExploreMode.Logs;
  }

  return [supportedModes, mode];
};

/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action: AnyAction): ExploreState => {
  if (splitCloseAction.match(action)) {
    const { itemId } = action.payload as SplitCloseActionPayload;
    const targetSplit = {
      left: itemId === ExploreId.left ? state.right : state.left,
      right: initialExploreState.right,
    };
    return {
      ...state,
      ...targetSplit,
      split: false,
    };
  }

  if (splitOpenAction.match(action)) {
    return { ...state, split: true, right: { ...action.payload.itemState } };
  }

  if (syncTimesAction.match(action)) {
    return { ...state, syncedTimes: action.payload.syncedTimes };
  }

  if (richHistoryUpdatedAction.match(action)) {
    return {
      ...state,
      richHistory: action.payload.richHistory,
    };
  }

  if (resetExploreAction.match(action)) {
    const payload: ResetExplorePayload = action.payload;
    const leftState = state[ExploreId.left];
    const rightState = state[ExploreId.right];
    stopQueryState(leftState.querySubscription);
    stopQueryState(rightState.querySubscription);

    if (payload.force || !Number.isInteger(state.left.originPanelId)) {
      return initialExploreState;
    }

    return {
      ...initialExploreState,
      left: {
        ...initialExploreItemState,
        queries: state.left.queries,
        originPanelId: state.left.originPanelId,
      },
    };
  }

  if (updateLocation.match(action)) {
    const payload: LocationUpdate = action.payload;
    const { query } = payload;
    if (!query || !query[ExploreId.left]) {
      return state;
    }

    const split = query[ExploreId.right] ? true : false;
    const leftState = state[ExploreId.left];
    const rightState = state[ExploreId.right];

    return {
      ...state,
      split,
      [ExploreId.left]: updateChildRefreshState(leftState, payload, ExploreId.left),
      [ExploreId.right]: updateChildRefreshState(rightState, payload, ExploreId.right),
    };
  }

  if (action.payload) {
    const { exploreId } = action.payload;
    if (exploreId !== undefined) {
      // @ts-ignore
      const exploreItemState = state[exploreId];
      return { ...state, [exploreId]: itemReducer(exploreItemState, action as any) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
