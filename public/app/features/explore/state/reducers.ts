import {
  calculateResultsFromQueryTransactions,
  generateEmptyQuery,
  getIntervals,
  ensureQueries,
} from 'app/core/utils/explore';
import { ExploreItemState, ExploreState, QueryTransaction } from 'app/types/explore';
import { DataQuery } from 'app/types/series';

import { Action, ActionTypes } from './actions';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

// Millies step for helper bar charts
const DEFAULT_GRAPH_INTERVAL = 15 * 1000;

const makeExploreItemState = (): ExploreItemState => ({
  StartPage: undefined,
  containerWidth: 0,
  datasourceInstance: null,
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

const initialExploreState: ExploreState = {
  split: null,
  left: makeExploreItemState(),
  right: makeExploreItemState(),
};

const itemReducer = (state, action: Action): ExploreItemState => {
  switch (action.type) {
    case ActionTypes.AddQueryRow: {
      const { initialQueries, modifiedQueries, queryTransactions } = state;
      const { index, query } = action;
      modifiedQueries[index + 1] = query;

      const nextQueries = [
        ...initialQueries.slice(0, index + 1),
        { ...modifiedQueries[index + 1] },
        ...initialQueries.slice(index + 1),
      ];

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
        modifiedQueries,
        initialQueries: nextQueries,
        logsHighlighterExpressions: undefined,
        queryTransactions: nextQueryTransactions,
      };
    }

    case ActionTypes.ChangeQuery: {
      const { initialQueries, queryTransactions } = state;
      let { modifiedQueries } = state;
      const { query, index, override } = action;
      modifiedQueries[index] = query;
      if (override) {
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
      return {
        ...state,
        modifiedQueries,
      };
    }

    case ActionTypes.ChangeSize: {
      const { range, datasourceInstance } = state;
      if (!datasourceInstance) {
        return state;
      }
      const containerWidth = action.width;
      const queryIntervals = getIntervals(range, datasourceInstance.interval, containerWidth);
      return { ...state, containerWidth, queryIntervals };
    }

    case ActionTypes.ChangeTime: {
      return {
        ...state,
        range: action.range,
      };
    }

    case ActionTypes.ClickClear: {
      const queries = ensureQueries();
      return {
        ...state,
        initialQueries: queries.slice(),
        modifiedQueries: queries.slice(),
        showingStartPage: Boolean(state.StartPage),
      };
    }

    case ActionTypes.ClickExample: {
      const modifiedQueries = [action.query];
      return { ...state, initialQueries: modifiedQueries.slice(), modifiedQueries };
    }

    case ActionTypes.ClickGraphButton: {
      const showingGraph = !state.showingGraph;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingGraph) {
        // Discard transactions related to Graph query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Graph');
      }
      return { ...state, queryTransactions: nextQueryTransactions, showingGraph };
    }

    case ActionTypes.ClickLogsButton: {
      const showingLogs = !state.showingLogs;
      let nextQueryTransactions = state.queryTransactions;
      if (!showingLogs) {
        // Discard transactions related to Logs query
        nextQueryTransactions = state.queryTransactions.filter(qt => qt.resultType !== 'Logs');
      }
      return { ...state, queryTransactions: nextQueryTransactions, showingLogs };
    }

    case ActionTypes.ClickTableButton: {
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

    case ActionTypes.InitializeExplore: {
      const { containerWidth, eventBridge, exploreDatasources, range } = action;
      return {
        ...state,
        containerWidth,
        eventBridge,
        exploreDatasources,
        range,
        initialDatasource: action.datasource,
        initialQueries: action.queries,
        initialized: true,
        modifiedQueries: action.queries.slice(),
      };
    }

    case ActionTypes.LoadDatasourceFailure: {
      return { ...state, datasourceError: action.error, datasourceLoading: false };
    }

    case ActionTypes.LoadDatasourceMissing: {
      return { ...state, datasourceMissing: true, datasourceLoading: false };
    }

    case ActionTypes.LoadDatasourcePending: {
      return { ...state, datasourceLoading: true, requestedDatasourceId: action.datasourceId };
    }

    case ActionTypes.LoadDatasourceSuccess: {
      const { containerWidth, range } = state;
      const queryIntervals = getIntervals(range, action.datasourceInstance.interval, containerWidth);

      return {
        ...state,
        queryIntervals,
        StartPage: action.StartPage,
        datasourceInstance: action.datasourceInstance,
        datasourceLoading: false,
        datasourceMissing: false,
        history: action.history,
        initialDatasource: action.initialDatasource,
        initialQueries: action.initialQueries,
        logsHighlighterExpressions: undefined,
        modifiedQueries: action.initialQueries.slice(),
        showingStartPage: action.showingStartPage,
        supportsGraph: action.supportsGraph,
        supportsLogs: action.supportsLogs,
        supportsTable: action.supportsTable,
      };
    }

    case ActionTypes.ModifyQueries: {
      const { initialQueries, modifiedQueries, queryTransactions } = state;
      const { action: modification, index, modifier } = action as any;
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

    case ActionTypes.RemoveQueryRow: {
      const { datasourceInstance, initialQueries, queryIntervals, queryTransactions } = state;
      let { modifiedQueries } = state;
      const { index } = action;

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

    case ActionTypes.QueryTransactionFailure: {
      const { queryTransactions } = action;
      return {
        ...state,
        queryTransactions,
        showingStartPage: false,
      };
    }

    case ActionTypes.QueryTransactionStart: {
      const { datasourceInstance, queryIntervals, queryTransactions } = state;
      const { resultType, rowIndex, transaction } = action;
      // Discarding existing transactions of same type
      const remainingTransactions = queryTransactions.filter(
        qt => !(qt.resultType === resultType && qt.rowIndex === rowIndex)
      );

      // Append new transaction
      const nextQueryTransactions: QueryTransaction[] = [...remainingTransactions, transaction];

      const results = calculateResultsFromQueryTransactions(
        nextQueryTransactions,
        datasourceInstance,
        queryIntervals.intervalMs
      );

      return {
        ...state,
        ...results,
        queryTransactions: nextQueryTransactions,
        showingStartPage: false,
      };
    }

    case ActionTypes.QueryTransactionSuccess: {
      const { datasourceInstance, queryIntervals } = state;
      const { history, queryTransactions } = action;
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

    case ActionTypes.ScanRange: {
      return { ...state, scanRange: action.range };
    }

    case ActionTypes.ScanStart: {
      return { ...state, scanning: true };
    }

    case ActionTypes.ScanStop: {
      const { queryTransactions } = state;
      const nextQueryTransactions = queryTransactions.filter(qt => qt.scanning && !qt.done);
      return { ...state, queryTransactions: nextQueryTransactions, scanning: false, scanRange: undefined };
    }
  }

  return state;
};

export const exploreReducer = (state = initialExploreState, action: Action): ExploreState => {
  switch (action.type) {
    case ActionTypes.ClickCloseSplit: {
      return {
        ...state,
        split: false,
      };
    }

    case ActionTypes.ClickSplit: {
      return {
        ...state,
        split: true,
        right: action.itemState,
      };
    }

    case ActionTypes.InitializeExploreSplit: {
      return {
        ...state,
        split: true,
      };
    }
  }

  const { exploreId } = action as any;
  if (exploreId !== undefined) {
    const exploreItemState = state[exploreId];
    return {
      ...state,
      [exploreId]: itemReducer(exploreItemState, action),
    };
  }

  console.error('Unhandled action', action.type);

  return state;
};

export default {
  explore: exploreReducer,
};
