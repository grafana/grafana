import _ from 'lodash';
import {
  calculateResultsFromQueryTransactions,
  getIntervals,
  ensureQueries,
  getQueryKeys,
  parseUrlState,
  DEFAULT_UI_STATE,
  generateNewKeyAndAddRefIdIfMissing,
  sortLogsResult,
} from 'app/core/utils/explore';
import { ExploreItemState, ExploreState, ExploreId, ExploreUpdateState, ExploreMode } from 'app/types/explore';
import { DataQuery, LogsModel } from '@grafana/ui';
import {
  HigherOrderAction,
  ActionTypes,
  testDataSourcePendingAction,
  testDataSourceSuccessAction,
  testDataSourceFailureAction,
  splitCloseAction,
  SplitCloseActionPayload,
  loadExploreDatasources,
  runQueriesAction,
  historyUpdatedAction,
  resetQueryErrorAction,
  changeModeAction,
} from './actionTypes';
import { reducerFactory } from 'app/core/redux';
import {
  addQueryRowAction,
  changeQueryAction,
  changeSizeAction,
  changeTimeAction,
  changeRefreshIntervalAction,
  clearQueriesAction,
  highlightLogsExpressionAction,
  initializeExploreAction,
  updateDatasourceInstanceAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  modifyQueriesAction,
  queryFailureAction,
  queryStartAction,
  querySuccessAction,
  removeQueryRowAction,
  scanRangeAction,
  scanStartAction,
  scanStopAction,
  setQueriesAction,
  toggleTableAction,
  queriesImportedAction,
  updateUIStateAction,
  toggleLogLevelAction,
} from './actionTypes';
import { updateLocation } from 'app/core/actions/location';
import { LocationUpdate } from 'app/types';
import TableModel from 'app/core/table_model';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import { subscriptionDataReceivedAction, startSubscriptionAction } from './epics';
import { seriesDataToLogsModel } from 'app/core/logs_model';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

// Millies step for helper bar charts
const DEFAULT_GRAPH_INTERVAL = 15 * 1000;

export const makeInitialUpdateState = (): ExploreUpdateState => ({
  datasource: false,
  queries: false,
  range: false,
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
  datasourceError: null,
  datasourceLoading: null,
  datasourceMissing: false,
  exploreDatasources: [],
  history: [],
  queries: [],
  initialized: false,
  queryIntervals: { interval: '15s', intervalMs: DEFAULT_GRAPH_INTERVAL },
  range: {
    from: null,
    to: null,
    raw: DEFAULT_RANGE,
  },
  scanning: false,
  scanRange: null,
  showingGraph: true,
  showingTable: true,
  graphIsLoading: false,
  logIsLoading: false,
  tableIsLoading: false,
  supportsGraph: null,
  supportsLogs: null,
  supportsTable: null,
  queryKeys: [],
  urlState: null,
  update: makeInitialUpdateState(),
  queryErrors: [],
  latency: 0,
  supportedModes: [],
  mode: null,
  isLive: false,
});

/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
export const initialExploreItemState = makeExploreItemState();
export const initialExploreState: ExploreState = {
  split: null,
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
    filter: changeTimeAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, range: action.payload.range };
    },
  })
  .addMapper({
    filter: changeRefreshIntervalAction,
    mapper: (state, action): ExploreItemState => {
      const { refreshInterval } = action.payload;
      const live = isLive(refreshInterval);
      const logsResult = sortLogsResult(state.logsResult, refreshInterval);

      return {
        ...state,
        refreshInterval: refreshInterval,
        graphIsLoading: live ? true : false,
        tableIsLoading: live ? true : false,
        logIsLoading: live ? true : false,
        isLive: live,
        logsResult,
      };
    },
  })
  .addMapper({
    filter: clearQueriesAction,
    mapper: (state): ExploreItemState => {
      const queries = ensureQueries();
      return {
        ...state,
        queries: queries.slice(),
        showingStartPage: Boolean(state.StartPage),
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
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
      const { containerWidth, eventBridge, queries, range, ui } = action.payload;
      return {
        ...state,
        containerWidth,
        eventBridge,
        range,
        queries,
        initialized: true,
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
        ...ui,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: updateDatasourceInstanceAction,
    mapper: (state, action): ExploreItemState => {
      const { datasourceInstance } = action.payload;
      // Capabilities
      const supportsGraph = datasourceInstance.meta.metrics;
      const supportsLogs = datasourceInstance.meta.logs;
      const supportsTable = datasourceInstance.meta.tables;

      let mode = ExploreMode.Metrics;
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

      // Custom components
      const StartPage = datasourceInstance.components.ExploreStartPage;

      return {
        ...state,
        datasourceInstance,
        queryErrors: [],
        latency: 0,
        graphIsLoading: false,
        logIsLoading: false,
        tableIsLoading: false,
        supportsGraph,
        supportsLogs,
        supportsTable,
        StartPage,
        showingStartPage: Boolean(StartPage),
        queryKeys: getQueryKeys(state.queries, datasourceInstance),
        supportedModes,
        mode,
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
    filter: queryFailureAction,
    mapper: (state, action): ExploreItemState => {
      const { resultType, response } = action.payload;
      const queryErrors = state.queryErrors.concat(response);

      return {
        ...state,
        graphResult: resultType === 'Graph' ? null : state.graphResult,
        tableResult: resultType === 'Table' ? null : state.tableResult,
        logsResult: resultType === 'Logs' ? null : state.logsResult,
        latency: 0,
        queryErrors,
        graphIsLoading: resultType === 'Graph' ? false : state.graphIsLoading,
        logIsLoading: resultType === 'Logs' ? false : state.logIsLoading,
        tableIsLoading: resultType === 'Table' ? false : state.tableIsLoading,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: queryStartAction,
    mapper: (state, action): ExploreItemState => {
      const { resultType } = action.payload;

      return {
        ...state,
        queryErrors: [],
        latency: 0,
        graphIsLoading: resultType === 'Graph' ? true : state.graphIsLoading,
        logIsLoading: resultType === 'Logs' ? true : state.logIsLoading,
        tableIsLoading: resultType === 'Table' ? true : state.tableIsLoading,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: querySuccessAction,
    mapper: (state, action): ExploreItemState => {
      const { queryIntervals, refreshInterval } = state;
      const { result, resultType, latency } = action.payload;
      const results = calculateResultsFromQueryTransactions(result, resultType, queryIntervals.intervalMs);
      const live = isLive(refreshInterval);

      if (live) {
        return state;
      }

      return {
        ...state,
        graphResult: resultType === 'Graph' ? results.graphResult : state.graphResult,
        tableResult: resultType === 'Table' ? results.tableResult : state.tableResult,
        logsResult:
          resultType === 'Logs'
            ? sortLogsResult(results.logsResult, refreshInterval)
            : sortLogsResult(state.logsResult, refreshInterval),
        latency,
        graphIsLoading: live ? true : false,
        logIsLoading: live ? true : false,
        tableIsLoading: live ? true : false,
        showingStartPage: false,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: startSubscriptionAction,
    mapper: (state): ExploreItemState => {
      const logsResult = sortLogsResult(state.logsResult, state.refreshInterval);

      return {
        ...state,
        logsResult,
        graphIsLoading: true,
        logIsLoading: true,
        tableIsLoading: true,
        showingStartPage: false,
        update: makeInitialUpdateState(),
      };
    },
  })
  .addMapper({
    filter: subscriptionDataReceivedAction,
    mapper: (state, action): ExploreItemState => {
      const { queryIntervals, refreshInterval } = state;
      const { data } = action.payload;
      const live = isLive(refreshInterval);

      if (!live) {
        return state;
      }

      const newResults = seriesDataToLogsModel([data], queryIntervals.intervalMs);
      const rowsInState = sortLogsResult(state.logsResult, state.refreshInterval).rows;

      const processedRows = [];
      for (const row of rowsInState) {
        processedRows.push({ ...row, fresh: false });
      }
      for (const row of newResults.rows) {
        processedRows.push({ ...row, fresh: true });
      }

      const rows = processedRows.slice(processedRows.length - 1000, 1000);

      const logsResult: LogsModel = state.logsResult ? { ...state.logsResult, rows } : { hasUniqueLabels: false, rows };

      return {
        ...state,
        logsResult,
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
    filter: scanRangeAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, scanRange: action.payload.range };
    },
  })
  .addMapper({
    filter: scanStartAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, scanning: true, scanner: action.payload.scanner };
    },
  })
  .addMapper({
    filter: scanStopAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        scanning: false,
        scanRange: undefined,
        scanner: undefined,
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
    filter: toggleTableAction,
    mapper: (state): ExploreItemState => {
      const showingTable = !state.showingTable;
      if (showingTable) {
        return { ...state };
      }

      return { ...state, tableResult: new TableModel() };
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
    filter: testDataSourcePendingAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        datasourceError: null,
      };
    },
  })
  .addMapper({
    filter: testDataSourceSuccessAction,
    mapper: (state): ExploreItemState => {
      return {
        ...state,
        datasourceError: null,
      };
    },
  })
  .addMapper({
    filter: testDataSourceFailureAction,
    mapper: (state, action): ExploreItemState => {
      return {
        ...state,
        datasourceError: action.payload.error,
        graphResult: undefined,
        tableResult: undefined,
        logsResult: undefined,
        update: makeInitialUpdateState(),
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
    filter: runQueriesAction,
    mapper: (state, action): ExploreItemState => {
      const { range } = action.payload;
      const { datasourceInstance, containerWidth } = state;
      let interval = '1s';
      if (datasourceInstance && datasourceInstance.interval) {
        interval = datasourceInstance.interval;
      }
      const queryIntervals = getIntervals(range, interval, containerWidth);
      return {
        ...state,
        range,
        queryIntervals,
        showingStartPage: false,
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
    filter: resetQueryErrorAction,
    mapper: (state, action): ExploreItemState => {
      const { refIds } = action.payload;
      const queryErrors = state.queryErrors.reduce((allErrors, error) => {
        if (error.refId && refIds.indexOf(error.refId) !== -1) {
          return allErrors;
        }

        return allErrors.concat(error);
      }, []);

      return {
        ...state,
        queryErrors,
      };
    },
  })
  .create();

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
      update: { datasource: false, queries: false, range: false, ui: false },
    };
  }

  const datasource = _.isEqual(urlState ? urlState.datasource : '', state.urlState.datasource) === false;
  const queries = _.isEqual(urlState ? urlState.queries : [], state.urlState.queries) === false;
  const range = _.isEqual(urlState ? urlState.range : DEFAULT_RANGE, state.urlState.range) === false;
  const ui = _.isEqual(urlState ? urlState.ui : DEFAULT_UI_STATE, state.urlState.ui) === false;

  return {
    ...state,
    urlState,
    update: {
      ...state.update,
      datasource,
      queries,
      range,
      ui,
    },
  };
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

    case ActionTypes.ResetExplore: {
      return initialExploreState;
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
  }

  if (action.payload) {
    const { exploreId } = action.payload as any;
    if (exploreId !== undefined) {
      const exploreItemState = state[exploreId];
      return { ...state, [exploreId]: itemReducer(exploreItemState, action) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
