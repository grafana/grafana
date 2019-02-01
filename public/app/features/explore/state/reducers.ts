import {
  calculateResultsFromQueryTransactions,
  generateEmptyQuery,
  getIntervals,
  ensureQueries,
} from 'app/core/utils/explore';
import { ExploreItemState, ExploreState, QueryTransaction } from 'app/types/explore';
import { DataQuery } from '@grafana/ui/src/types';

import { Action, ActionTypes } from './actionTypes';

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
  initialQueries: [],
  initialized: false,
  modifiedQueries: [],
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
export const itemReducer = (state, action: Action): ExploreItemState => {
  switch (action.type) {
    case ActionTypes.AddQueryRow: {
      const { initialQueries, modifiedQueries, queryTransactions } = state;
      const { index, query } = action.payload;

      // Add new query row after given index, keep modifications of existing rows
      const nextModifiedQueries = [
        ...modifiedQueries.slice(0, index + 1),
        { ...query },
        ...initialQueries.slice(index + 1),
      ];

      // Add to initialQueries, which will cause a new row to be rendered
      const nextQueries = [...initialQueries.slice(0, index + 1), { ...query }, ...initialQueries.slice(index + 1)];

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
        initialQueries: nextQueries,
        logsHighlighterExpressions: undefined,
        modifiedQueries: nextModifiedQueries,
        queryTransactions: nextQueryTransactions,
      };
    }

    case ActionTypes.ChangeQuery: {
      const { initialQueries, queryTransactions } = state;
      let { modifiedQueries } = state;
      const { query, index, override } = action.payload;

      // Fast path: only change modifiedQueries to not trigger an update
      modifiedQueries[index] = query;
      if (!override) {
        return {
          ...state,
          modifiedQueries,
        };
      }

      // Override path: queries are completely reset
      const nextQuery: DataQuery = {
        ...query,
        ...generateEmptyQuery(index),
      };
      const nextQueries = [...initialQueries];
      nextQueries[index] = nextQuery;
      modifiedQueries = [...nextQueries];

      // Discard ongoing transaction related to row query
      const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);

      return {
        ...state,
        initialQueries: nextQueries,
        modifiedQueries: nextQueries.slice(),
        queryTransactions: nextQueryTransactions,
      };
    }

    case ActionTypes.ChangeSize: {
      const { range, datasourceInstance } = state;
      let interval = '1s';
      if (datasourceInstance && datasourceInstance.interval) {
        interval = datasourceInstance.interval;
      }
      const containerWidth = action.payload.width;
      const queryIntervals = getIntervals(range, interval, containerWidth);
      return { ...state, containerWidth, queryIntervals };
    }

    case ActionTypes.ChangeTime: {
      return {
        ...state,
        range: action.payload.range,
      };
    }

    case ActionTypes.ClearQueries: {
      const queries = ensureQueries();
      return {
        ...state,
        initialQueries: queries.slice(),
        modifiedQueries: queries.slice(),
        queryTransactions: [],
        showingStartPage: Boolean(state.StartPage),
      };
    }

    case ActionTypes.HighlightLogsExpression: {
      const { expressions } = action.payload;
      return { ...state, logsHighlighterExpressions: expressions };
    }

    case ActionTypes.InitializeExplore: {
      const { containerWidth, eventBridge, exploreDatasources, queries, range } = action.payload;
      return {
        ...state,
        containerWidth,
        eventBridge,
        exploreDatasources,
        range,
        initialQueries: queries,
        initialized: true,
        modifiedQueries: queries.slice(),
      };
    }

    case ActionTypes.UpdateDatasourceInstance: {
      const { datasourceInstance } = action.payload;
      return {
        ...state,
        datasourceInstance,
        datasourceName: datasourceInstance.name,
      };
    }

    case ActionTypes.LoadDatasourceFailure: {
      return { ...state, datasourceError: action.payload.error, datasourceLoading: false };
    }

    case ActionTypes.LoadDatasourceMissing: {
      return { ...state, datasourceMissing: true, datasourceLoading: false };
    }

    case ActionTypes.LoadDatasourcePending: {
      return { ...state, datasourceLoading: true, requestedDatasourceName: action.payload.requestedDatasourceName };
    }

    case ActionTypes.LoadDatasourceSuccess: {
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
    }

    case ActionTypes.ModifyQueries: {
      const { initialQueries, modifiedQueries, queryTransactions } = state;
      const { modification, index, modifier } = action.payload as any;
      let nextQueries: DataQuery[];
      let nextQueryTransactions;
      if (index === undefined) {
        // Modify all queries
        nextQueries = initialQueries.map((query, i) => ({
          ...modifier(modifiedQueries[i], modification),
          ...generateEmptyQuery(i),
        }));
        // Discard all ongoing transactions
        nextQueryTransactions = [];
      } else {
        // Modify query only at index
        nextQueries = initialQueries.map((query, i) => {
          // Synchronize all queries with local query cache to ensure consistency
          // TODO still needed?
          return i === index
            ? {
                ...modifier(modifiedQueries[i], modification),
                ...generateEmptyQuery(i),
              }
            : query;
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
        initialQueries: nextQueries,
        modifiedQueries: nextQueries.slice(),
        queryTransactions: nextQueryTransactions,
      };
    }

    case ActionTypes.QueryTransactionFailure: {
      const { queryTransactions } = action.payload;
      return {
        ...state,
        queryTransactions,
        showingStartPage: false,
      };
    }

    case ActionTypes.QueryTransactionStart: {
      const { queryTransactions } = state;
      const { resultType, rowIndex, transaction } = action.payload;
      // Discarding existing transactions of same type
      const remainingTransactions = queryTransactions.filter(
        qt => !(qt.resultType === resultType && qt.rowIndex === rowIndex)
      );

      // Append new transaction
      const nextQueryTransactions: QueryTransaction[] = [...remainingTransactions, transaction];

      return {
        ...state,
        queryTransactions: nextQueryTransactions,
        showingStartPage: false,
      };
    }

    case ActionTypes.QueryTransactionSuccess: {
      const { datasourceInstance, queryIntervals } = state;
      const { history, queryTransactions } = action.payload;
      const results = calculateResultsFromQueryTransactions(
        queryTransactions,
        datasourceInstance,
        queryIntervals.intervalMs
      );

      return {
        ...state,
        ...results,
        history,
        queryTransactions,
        showingStartPage: false,
      };
    }

    case ActionTypes.RemoveQueryRow: {
      const { datasourceInstance, initialQueries, queryIntervals, queryTransactions } = state;
      let { modifiedQueries } = state;
      const { index } = action.payload;

      modifiedQueries = [...modifiedQueries.slice(0, index), ...modifiedQueries.slice(index + 1)];

      if (initialQueries.length <= 1) {
        return state;
      }

      const nextQueries = [...initialQueries.slice(0, index), ...initialQueries.slice(index + 1)];

      // Discard transactions related to row query
      const nextQueryTransactions = queryTransactions.filter(qt => qt.rowIndex !== index);
      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        datasourceInstance,
        queryIntervals.intervalMs
      );

      return {
        ...state,
        ...results,
        initialQueries: nextQueries,
        logsHighlighterExpressions: undefined,
        modifiedQueries: nextQueries.slice(),
        queryTransactions: nextQueryTransactions,
      };
    }

    case ActionTypes.RunQueriesEmpty: {
      return { ...state, queryTransactions: [] };
    }

    case ActionTypes.ScanRange: {
      return { ...state, scanRange: action.payload.range };
    }

    case ActionTypes.ScanStart: {
      return { ...state, scanning: true, scanner: action.payload.scanner };
    }

    case ActionTypes.ScanStop: {
      const { queryTransactions } = state;
      const nextQueryTransactions = queryTransactions.filter(qt => qt.scanning && !qt.done);
      return {
        ...state,
        queryTransactions: nextQueryTransactions,
        scanning: false,
        scanRange: undefined,
        scanner: undefined,
      };
    }

    case ActionTypes.SetQueries: {
      const { queries } = action.payload;
      return { ...state, initialQueries: queries.slice(), modifiedQueries: queries.slice() };
    }

    case ActionTypes.ToggleGraph: {
      const showingGraph = !state.showingGraph;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingGraph) {
        // Discard transactions related to Graph query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Graph');
      }
      return { ...state, queryTransactions: nextQueryTransactions, showingGraph };
    }

    case ActionTypes.ToggleLogs: {
      const showingLogs = !state.showingLogs;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingLogs) {
        // Discard transactions related to Logs query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Logs');
      }
      return { ...state, queryTransactions: nextQueryTransactions, showingLogs };
    }

    case ActionTypes.ToggleTable: {
      const showingTable = !state.showingTable;
      if (showingTable) {
        return { ...state, showingTable, queryTransactions: state.queryTransactions };
      }

      // Toggle off needs discarding of table queries and results
      const nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Table');
      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        state.datasourceInstance,
        state.queryIntervals.intervalMs
      );

      return { ...state, ...results, queryTransactions: nextQueryTransactions, showingTable };
    }

    case ActionTypes.QueriesImported: {
      return {
        ...state,
        initialQueries: action.payload.queries,
        modifiedQueries: action.payload.queries.slice(),
      };
    }
  }

  return state;
};

/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action: Action): ExploreState => {
  switch (action.type) {
    case ActionTypes.SplitClose: {
      return { ...state, split: false };
    }

    case ActionTypes.SplitOpen: {
      return { ...state, split: true, right: action.payload.itemState };
    }

    case ActionTypes.InitializeExploreSplit: {
      return { ...state, split: true };
    }

    case ActionTypes.ResetExplore: {
      return initialExploreState;
    }
  }

  if (action.payload) {
    const { exploreId } = action.payload as any;
    if (exploreId !== undefined) {
      const exploreItemState = state[exploreId];
      return {
        ...state,
        [exploreId]: itemReducer(exploreItemState, action),
      };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
