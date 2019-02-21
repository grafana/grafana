import {
  calculateResultsFromQueryTransactions,
  generateEmptyQuery,
  getIntervals,
  ensureQueries,
  getQueryKeys,
} from 'app/core/utils/explore';
import { ExploreItemState, ExploreState, QueryTransaction } from 'app/types/explore';
import { DataQuery } from '@grafana/ui/src/types';

import { reducerFactory } from 'app/core/redux';
import {
  splitCloseAction,
  splitOpenAction,
  initializeExploreSplitAction,
  resetExploreAction,
  addQueryRowAction,
  changeQueryAction,
  changeSizeAction,
  changeTimeAction,
  clearQueriesAction,
  highlightLogsExpressionAction,
  initializeExploreAction,
  updateDatasourceInstanceAction,
  loadDatasourceFailureAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceSuccessAction,
  modifyQueriesAction,
  queryTransactionFailureAction,
  queryTransactionStartAction,
  queryTransactionSuccessAction,
  removeQueryRowAction,
  runQueriesEmptyAction,
  scanRangeAction,
  scanStartAction,
  scanStopAction,
  setQueriesAction,
  toggleGraphAction,
  toggleLogsAction,
  toggleTableAction,
  queriesImportedAction,
  updateUIStateAction,
  toggleLogLevelAction,
} from './actionTypes';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

// Millies step for helper bar charts
const DEFAULT_GRAPH_INTERVAL = 15 * 1000;

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
  queryTransactions: [],
  queryIntervals: { interval: '15s', intervalMs: DEFAULT_GRAPH_INTERVAL },
  range: DEFAULT_RANGE,
  scanning: false,
  scanRange: null,
  showingGraph: true,
  showingLogs: true,
  showingTable: true,
  supportsGraph: null,
  supportsLogs: null,
  supportsTable: null,
  queryKeys: [],
});

/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
export const initialExploreState: ExploreState = {
  split: null,
  left: makeExploreItemState(),
  right: makeExploreItemState(),
};

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
export const itemReducer = reducerFactory<ExploreItemState>({} as ExploreItemState)
  .addHigherOrderMapper({
    filter: addQueryRowAction,
    mapper: (state, action): ExploreItemState => {
      const { queries, queryTransactions } = state;
      const { index, query } = action.payload;

      // Add to queries, which will cause a new row to be rendered
      const nextQueries = [...queries.slice(0, index + 1), { ...query }, ...queries.slice(index + 1)];

      // Ongoing transactions need to update their row indices
      const nextQueryTransactions = queryTransactions.map(qt => {
        if (qt.rowIndex > index) {
          return {
            ...qt,
            rowIndex: qt.rowIndex + 1,
          };
        }
        return qt;
      });

      return {
        ...state,
        queries: nextQueries,
        logsHighlighterExpressions: undefined,
        queryTransactions: nextQueryTransactions,
        queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
      };
    },
  })
  .addHigherOrderMapper({
    filter: changeQueryAction,
    mapper: (state, action): ExploreItemState => {
      const { queries, queryTransactions } = state;
      const { query, index } = action.payload;

      // Override path: queries are completely reset
      const nextQuery: DataQuery = { ...query, ...generateEmptyQuery(index) };
      const nextQueries = [...queries];
      nextQueries[index] = nextQuery;

      // Discard ongoing transaction related to row query
      const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

      return {
        ...state,
        queries: nextQueries,
        queryTransactions: nextQueryTransactions,
        queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
      };
    },
  })
  .addHigherOrderMapper({
    filter: changeSizeAction,
    mapper: (state, action): ExploreItemState => {
      const { range, datasourceInstance } = state;
      let interval = '1s';
      if (datasourceInstance && datasourceInstance.interval) {
        interval = datasourceInstance.interval;
      }
      const containerWidth = action.payload.width;
      const queryIntervals = getIntervals(range, interval, containerWidth);
      return { ...state, containerWidth, queryIntervals };
    },
  })
  .addHigherOrderMapper({
    filter: changeTimeAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, range: action.payload.range };
    },
  })
  .addHigherOrderMapper({
    filter: clearQueriesAction,
    mapper: (state): ExploreItemState => {
      const queries = ensureQueries();
      return {
        ...state,
        queries: queries.slice(),
        queryTransactions: [],
        showingStartPage: Boolean(state.StartPage),
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
      };
    },
  })
  .addHigherOrderMapper({
    filter: highlightLogsExpressionAction,
    mapper: (state, action): ExploreItemState => {
      const { expressions } = action.payload;
      return { ...state, logsHighlighterExpressions: expressions };
    },
  })
  .addHigherOrderMapper({
    filter: initializeExploreAction,
    mapper: (state, action): ExploreItemState => {
      const { containerWidth, eventBridge, exploreDatasources, queries, range, ui } = action.payload;
      return {
        ...state,
        containerWidth,
        eventBridge,
        exploreDatasources,
        range,
        queries,
        initialized: true,
        queryKeys: getQueryKeys(queries, state.datasourceInstance),
        ...ui,
      };
    },
  })
  .addHigherOrderMapper({
    filter: updateDatasourceInstanceAction,
    mapper: (state, action): ExploreItemState => {
      const { datasourceInstance } = action.payload;
      return { ...state, datasourceInstance, queryKeys: getQueryKeys(state.queries, datasourceInstance) };
    },
  })
  .addHigherOrderMapper({
    filter: loadDatasourceFailureAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, datasourceError: action.payload.error, datasourceLoading: false };
    },
  })
  .addHigherOrderMapper({
    filter: loadDatasourceMissingAction,
    mapper: (state): ExploreItemState => {
      return { ...state, datasourceMissing: true, datasourceLoading: false };
    },
  })
  .addHigherOrderMapper({
    filter: loadDatasourcePendingAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, datasourceLoading: true, requestedDatasourceName: action.payload.requestedDatasourceName };
    },
  })
  .addHigherOrderMapper({
    filter: loadDatasourceSuccessAction,
    mapper: (state, action): ExploreItemState => {
      const { containerWidth, range } = state;
      const {
        StartPage,
        datasourceInstance,
        history,
        showingStartPage,
        supportsGraph,
        supportsLogs,
        supportsTable,
      } = action.payload;
      const queryIntervals = getIntervals(range, datasourceInstance.interval, containerWidth);

      return {
        ...state,
        queryIntervals,
        StartPage,
        datasourceInstance,
        history,
        showingStartPage,
        supportsGraph,
        supportsLogs,
        supportsTable,
        datasourceLoading: false,
        datasourceMissing: false,
        datasourceError: null,
        logsHighlighterExpressions: undefined,
        queryTransactions: [],
      };
    },
  })
  .addHigherOrderMapper({
    filter: modifyQueriesAction,
    mapper: (state, action): ExploreItemState => {
      const { queries, queryTransactions } = state;
      const { modification, index, modifier } = action.payload;
      let nextQueries: DataQuery[];
      let nextQueryTransactions;
      if (index === undefined) {
        // Modify all queries
        nextQueries = queries.map((query, i) => ({
          ...modifier({ ...query }, modification),
          ...generateEmptyQuery(i),
        }));
        // Discard all ongoing transactions
        nextQueryTransactions = [];
      } else {
        // Modify query only at index
        nextQueries = queries.map((query, i) => {
          // Synchronize all queries with local query cache to ensure consistency
          // TODO still needed?
          return i === index ? { ...modifier({ ...query }, modification), ...generateEmptyQuery(i) } : query;
        });
        nextQueryTransactions = queryTransactions
          // Consume the hint corresponding to the action
          .map(qt => {
            if (qt.hints != null && qt.rowIndex === index) {
              qt.hints = qt.hints.filter(hint => hint.fix.action !== modification);
            }
            return qt;
          })
          // Preserve previous row query transaction to keep results visible if next query is incomplete
          .filter(qt => modification.preventSubmit || qt.rowIndex !== index);
      }
      return {
        ...state,
        queries: nextQueries,
        queryKeys: getQueryKeys(nextQueries, state.datasourceInstance),
        queryTransactions: nextQueryTransactions,
      };
    },
  })
  .addHigherOrderMapper({
    filter: queryTransactionFailureAction,
    mapper: (state, action): ExploreItemState => {
      const { queryTransactions } = action.payload;
      return { ...state, queryTransactions, showingStartPage: false };
    },
  })
  .addHigherOrderMapper({
    filter: queryTransactionStartAction,
    mapper: (state, action): ExploreItemState => {
      const { queryTransactions } = state;
      const { resultType, rowIndex, transaction } = action.payload;
      // Discarding existing transactions of same type
      const remainingTransactions = queryTransactions.filter(
        qt => !(qt.resultType === resultType && qt.rowIndex === rowIndex)
      );

      // Append new transaction
      const nextQueryTransactions: QueryTransaction[] = [...remainingTransactions, transaction];

      return { ...state, queryTransactions: nextQueryTransactions, showingStartPage: false };
    },
  })
  .addHigherOrderMapper({
    filter: queryTransactionSuccessAction,
    mapper: (state, action): ExploreItemState => {
      const { datasourceInstance, queryIntervals } = state;
      const { history, queryTransactions } = action.payload;
      const results = calculateResultsFromQueryTransactions(
        queryTransactions,
        datasourceInstance,
        queryIntervals.intervalMs
      );

      return { ...state, ...results, history, queryTransactions, showingStartPage: false };
    },
  })
  .addHigherOrderMapper({
    filter: removeQueryRowAction,
    mapper: (state, action): ExploreItemState => {
      const { datasourceInstance, queries, queryIntervals, queryTransactions, queryKeys } = state;
      const { index } = action.payload;

      if (queries.length <= 1) {
        return state;
      }

      const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
      const nextQueryKeys = [...queryKeys.slice(0, index), ...queryKeys.slice(index + 1)];

      // Discard transactions related to row query
      const nextQueryTransactions = queryTransactions.filter(qt => nextQueries.some(nq => nq.key === qt.query.key));
      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        datasourceInstance,
        queryIntervals.intervalMs
      );

      return {
        ...state,
        ...results,
        queries: nextQueries,
        logsHighlighterExpressions: undefined,
        queryTransactions: nextQueryTransactions,
        queryKeys: nextQueryKeys,
      };
    },
  })
  .addHigherOrderMapper({
    filter: runQueriesEmptyAction,
    mapper: (state): ExploreItemState => {
      return { ...state, queryTransactions: [] };
    },
  })
  .addHigherOrderMapper({
    filter: scanRangeAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, scanRange: action.payload.range };
    },
  })
  .addHigherOrderMapper({
    filter: scanStartAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, scanning: true, scanner: action.payload.scanner };
    },
  })
  .addHigherOrderMapper({
    filter: scanStopAction,
    mapper: (state): ExploreItemState => {
      const { queryTransactions } = state;
      const nextQueryTransactions = queryTransactions.filter(qt => qt.scanning && !qt.done);
      return {
        ...state,
        queryTransactions: nextQueryTransactions,
        scanning: false,
        scanRange: undefined,
        scanner: undefined,
      };
    },
  })
  .addHigherOrderMapper({
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
  .addHigherOrderMapper({
    filter: updateUIStateAction,
    mapper: (state, action): ExploreItemState => {
      return { ...state, ...action.payload };
    },
  })
  .addHigherOrderMapper({
    filter: toggleGraphAction,
    mapper: (state): ExploreItemState => {
      const showingGraph = !state.showingGraph;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingGraph) {
        // Discard transactions related to Graph query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Graph');
      }
      return { ...state, queryTransactions: nextQueryTransactions };
    },
  })
  .addHigherOrderMapper({
    filter: toggleLogsAction,
    mapper: (state): ExploreItemState => {
      const showingLogs = !state.showingLogs;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingLogs) {
        // Discard transactions related to Logs query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Logs');
      }
      return { ...state, queryTransactions: nextQueryTransactions };
    },
  })
  .addHigherOrderMapper({
    filter: toggleTableAction,
    mapper: (state): ExploreItemState => {
      const showingTable = !state.showingTable;
      if (showingTable) {
        return { ...state, queryTransactions: state.queryTransactions };
      }

      // Toggle off needs discarding of table queries and results
      const nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Table');
      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        state.datasourceInstance,
        state.queryIntervals.intervalMs
      );

      return { ...state, ...results, queryTransactions: nextQueryTransactions };
    },
  })
  .addHigherOrderMapper({
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
  .addHigherOrderMapper({
    filter: toggleLogLevelAction,
    mapper: (state, action): ExploreItemState => {
      const { hiddenLogLevels } = action.payload;
      return {
        ...state,
        hiddenLogLevels: Array.from(hiddenLogLevels),
      };
    },
  })
  .create();

export const exploreReducer = reducerFactory<ExploreState>(initialExploreState)
  .addMapper({
    filter: splitCloseAction,
    mapper: (state): ExploreState => ({ ...state, split: false }),
  })
  .addMapper({
    filter: splitOpenAction,
    mapper: (state, action): ExploreState => ({ ...state, split: true, right: action.payload.itemState }),
  })
  .addMapper({
    filter: initializeExploreSplitAction,
    mapper: (state): ExploreState => ({ ...state, split: true }),
  })
  .addMapper({
    filter: resetExploreAction,
    mapper: (): ExploreState => initialExploreState,
  })
  .addReducer(itemReducer)
  .create();

export default {
  explore: exploreReducer,
};
