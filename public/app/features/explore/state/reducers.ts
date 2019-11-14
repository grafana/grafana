import _ from 'lodash';
import {
  ensureQueries,
  getQueryKeys,
  parseUrlState,
  DEFAULT_UI_STATE,
  generateNewKeyAndAddRefIdIfMissing,
  sortLogsResult,
  stopQueryState,
  refreshIntervalToSortOrder,
} from 'app/core/utils/explore';
import { ExploreItemState, ExploreState, ExploreId, ExploreUpdateState, ExploreMode } from 'app/types/explore';
import {
  LoadingState,
  toLegacyResponseData,
  DefaultTimeRange,
  DataQuery,
  DataSourceApi,
  PanelData,
  DataQueryRequest,
  PanelEvents,
  TimeZone,
} from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';
import {
  HigherOrderAction,
  ActionTypes,
  splitCloseAction,
  SplitCloseActionPayload,
  loadExploreDatasources,
  historyUpdatedAction,
  changeModeAction,
  setUrlReplacedAction,
  scanStopAction,
  queryStartAction,
  changeRangeAction,
  clearOriginAction,
  addQueryRowAction,
  changeQueryAction,
  changeSizeAction,
  changeRefreshIntervalAction,
  clearQueriesAction,
  highlightLogsExpressionAction,
  initializeExploreAction,
  updateDatasourceInstanceAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  modifyQueriesAction,
  removeQueryRowAction,
  scanStartAction,
  setQueriesAction,
  toggleTableAction,
  queriesImportedAction,
  updateUIStateAction,
  toggleLogLevelAction,
  changeLoadingStateAction,
  resetExploreAction,
  queryStreamUpdatedAction,
  QueryEndedPayload,
  queryStoreSubscriptionAction,
  setPausedStateAction,
  toggleGraphAction,
} from './actionTypes';
import { reducerFactory, ActionOf } from 'app/core/redux';
import { updateLocation } from 'app/core/actions/location';
import { LocationUpdate } from '@grafana/runtime';
import TableModel from 'app/core/table_model';
import { ResultProcessor } from '../utils/ResultProcessor';

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
  StartPage: undefined,
  containerWidth: 0,
  datasourceInstance: null,
  requestedDatasourceName: null,
  datasourceLoading: null,
  datasourceMissing: false,
  exploreDatasources: [],
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
  split: null,
  syncedTimes: false,
  left: initialExploreItemState,
  right: initialExploreItemState,
};

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
export const itemReducer = reducerFactory<ExploreItemState>({} as ExploreItemState)
  .addMapper({
    filter: addQueryRowAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: changeQueryAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: changeSizeAction,
    mapper: (state, action): ExploreItemState => {
      const containerWidth = action.payload.width;
      return { ...state, containerWidth };
    },
  })
  .addMapper({
    filter: changeModeAction,
    mapper: (state, action): ExploreItemState => {
      const mode = action.payload.mode;
      return { ...state, mode };
    },
  })
  .addMapper({
    filter: changeRefreshIntervalAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: clearQueriesAction,
    mapper: (state): ExploreItemState => {
      const queries = ensureQueries();
      stopQueryState(state.querySubscription);
      return {
        ...state,
        queries: queries.slice(),
        graphResult: null,
        tableResult: null,
        logsResult: null,
        showingStartPage: Boolean(state.StartPage),
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
        queryResponse: createEmptyQueryResponse(),
        loading: false,
      };
    },
  })
  .addMapper({
    filter: clearOriginAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        originPanelId: undefined,
      };
    },
  })
  .addMapper({
    filter: highlightLogsExpressionAction,
    mapper: (state, action): ExploreItemState => {
      const { expressions } = action.payload;
      return { ...state, logsHighlighterExpressions: expressions };
    },
  })
  .addMapper({
    filter: initializeExploreAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: updateDatasourceInstanceAction,
    mapper: (state, action): ExploreItemState => {
      const { datasourceInstance } = action.payload;
      const [supportedModes, mode] = getModesForDatasource(datasourceInstance, state.mode);

      const originPanelId = state.urlState && state.urlState.originPanelId;

      // Custom components
      const StartPage = datasourceInstance.components.ExploreStartPage;
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
        StartPage,
        showingStartPage: Boolean(StartPage),
        queryKeys: [],
        supportedModes,
        mode,
        originPanelId,
      };
    },
  })
  .addMapper({
    filter: loadDatasourceMissingAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        datasourceMissing: true,
        datasourceLoading: false,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: loadDatasourcePendingAction,
    mapper: (state, action): ExploreItemState => {
      return {
        ...state,
        datasourceLoading: true,
        requestedDatasourceName: action.payload.requestedDatasourceName,
      };
    },
  })
  .addMapper({
    filter: loadDatasourceReadyAction,
    mapper: (state, action): ExploreItemState => {
      const { history } = action.payload;
      return {
        ...state,
        history,
        datasourceLoading: false,
        datasourceMissing: false,
        logsHighlighterExpressions: undefined,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: modifyQueriesAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: queryStartAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        latency: 0,
        queryResponse: {
          ...state.queryResponse,
          state: LoadingState.Loading,
          error: null,
        },
        loading: true,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: removeQueryRowAction,
    mapper: (state, action): ExploreItemState => {
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
    },
  })
  .addMapper({
    filter: scanStartAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, scanning: true };
    },
  })
  .addMapper({
    filter: scanStopAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        scanning: false,
        scanRange: undefined,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: setQueriesAction,
    mapper: (state, action): ExploreItemState => {
      const { queries } = action.payload;
      return {
        ...state,
        queries: queries.slice(),
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
      };
    },
  })
  .addMapper({
    filter: updateUIStateAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, ...action.payload };
    },
  })
  .addMapper({
    filter: toggleGraphAction,
    mapper: (state): ExploreItemState => {
      const showingGraph = !state.showingGraph;
      if (showingGraph) {
        return { ...state, showingGraph };
      }

      return { ...state, showingGraph, graphResult: null };
    },
  })
  .addMapper({
    filter: toggleTableAction,
    mapper: (state): ExploreItemState => {
      const showingTable = !state.showingTable;
      if (showingTable) {
        return { ...state, showingTable };
      }

      return { ...state, showingTable, tableResult: new TableModel() };
    },
  })
  .addMapper({
    filter: queriesImportedAction,
    mapper: (state, action): ExploreItemState => {
      const { queries } = action.payload;
      return {
        ...state,
        queries,
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
      };
    },
  })
  .addMapper({
    filter: toggleLogLevelAction,
    mapper: (state, action): ExploreItemState => {
      const { hiddenLogLevels } = action.payload;
      return {
        ...state,
        hiddenLogLevels: Array.from(hiddenLogLevels),
      };
    },
  })
  .addMapper({
    filter: loadExploreDatasources,
    mapper: (state, action): ExploreItemState => {
      return {
        ...state,
        exploreDatasources: action.payload.exploreDatasources,
      };
    },
  })
  .addMapper({
    filter: historyUpdatedAction,
    mapper: (state, action): ExploreItemState => {
      return {
        ...state,
        history: action.payload.history,
      };
    },
  })
  .addMapper({
    filter: setUrlReplacedAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        urlReplaced: true,
      };
    },
  })
  .addMapper({
    filter: changeRangeAction,
    mapper: (state, action): ExploreItemState => {
      const { range, absoluteRange } = action.payload;
      return {
        ...state,
        range,
        absoluteRange,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: changeLoadingStateAction,
    mapper: (state, action): ExploreItemState => {
      const { loadingState } = action.payload;
      return {
        ...state,
        queryResponse: {
          ...state.queryResponse,
          state: loadingState,
        },
        loading: loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming,
      };
    },
  })
  .addMapper({
    filter: setPausedStateAction,
    mapper: (state, action): ExploreItemState => {
      const { isPaused } = action.payload;
      return {
        ...state,
        isPaused: isPaused,
      };
    },
  })
  .addMapper({
    filter: queryStoreSubscriptionAction,
    mapper: (state, action): ExploreItemState => {
      const { querySubscription } = action.payload;
      return {
        ...state,
        querySubscription,
      };
    },
  })
  .addMapper({
    filter: queryStreamUpdatedAction,
    mapper: (state, action): ExploreItemState => {
      return processQueryResponse(state, action);
    },
  })
  .create();

export const processQueryResponse = (
  state: ExploreItemState,
  action: ActionOf<QueryEndedPayload>
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
      showingStartPage: false,
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
    showingStartPage: false,
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
  // Temporary hack here. We want Loki to work in dashboards for which it needs to have metrics = true which is weird
  // for Explore.
  // TODO: need to figure out a better way to handle this situation
  const supportsGraph = dataSource.meta.name === 'Loki' ? false : dataSource.meta.metrics;
  const supportsLogs = dataSource.meta.logs;

  let mode = currentMode || ExploreMode.Metrics;
  const supportedModes: ExploreMode[] = [];

  if (supportsGraph) {
    supportedModes.push(ExploreMode.Metrics);
  }

  if (supportsLogs) {
    supportedModes.push(ExploreMode.Logs);
  }

  if (supportedModes.length === 1) {
    mode = supportedModes[0];
  }

  return [supportedModes, mode];
};

/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action: HigherOrderAction): ExploreState => {
  switch (action.type) {
    case splitCloseAction.type: {
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

    case ActionTypes.SplitOpen: {
      return { ...state, split: true, right: { ...action.payload.itemState } };
    }
    case ActionTypes.SyncTimes: {
      return { ...state, syncedTimes: action.payload.syncedTimes };
    }

    case ActionTypes.ResetExplore: {
      if (action.payload.force || !Number.isInteger(state.left.originPanelId)) {
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

    case updateLocation.type: {
      const { query } = action.payload;
      if (!query || !query[ExploreId.left]) {
        return state;
      }

      const split = query[ExploreId.right] ? true : false;
      const leftState = state[ExploreId.left];
      const rightState = state[ExploreId.right];

      return {
        ...state,
        split,
        [ExploreId.left]: updateChildRefreshState(leftState, action.payload, ExploreId.left),
        [ExploreId.right]: updateChildRefreshState(rightState, action.payload, ExploreId.right),
      };
    }

    case resetExploreAction.type: {
      const leftState = state[ExploreId.left];
      const rightState = state[ExploreId.right];
      stopQueryState(leftState.querySubscription);
      stopQueryState(rightState.querySubscription);

      return {
        ...state,
        [ExploreId.left]: updateChildRefreshState(leftState, action.payload, ExploreId.left),
        [ExploreId.right]: updateChildRefreshState(rightState, action.payload, ExploreId.right),
      };
    }
  }

  if (action.payload) {
    const { exploreId } = action.payload as any;
    if (exploreId !== undefined) {
      // @ts-ignore
      const exploreItemState = state[exploreId];
      return { ...state, [exploreId]: itemReducer(exploreItemState, action) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
