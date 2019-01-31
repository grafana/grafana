// Libraries
import _ from 'lodash';
import { ThunkAction } from 'redux-thunk';

// Services & Utils
import store from 'app/core/store';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { Emitter } from 'app/core/core';
import {
  LAST_USED_DATASOURCE_KEY,
  clearQueryKeys,
  ensureQueries,
  generateEmptyQuery,
  hasNonEmptyQuery,
  makeTimeSeriesList,
  updateHistory,
  buildQueryTransaction,
  serializeStateToUrlParam,
} from 'app/core/utils/explore';

// Actions
import { updateLocation } from 'app/core/actions';

// Types
import { StoreState } from 'app/types';
import {
  RawTimeRange,
  TimeRange,
  DataSourceApi,
  DataQuery,
  DataSourceSelectItem,
  QueryHint,
} from '@grafana/ui/src/types';
import {
  ExploreId,
  ExploreUrlState,
  RangeScanner,
  ResultType,
  QueryOptions,
  QueryTransaction,
} from 'app/types/explore';

import {
  Action as ThunkableAction,
  ActionTypes,
  AddQueryRowAction,
  ChangeSizeAction,
  HighlightLogsExpressionAction,
  LoadDatasourceFailureAction,
  LoadDatasourceMissingAction,
  LoadDatasourcePendingAction,
  LoadDatasourceSuccessAction,
  QueryTransactionStartAction,
  ScanStopAction,
  UpdateDatasourceInstanceAction,
  QueriesImported,
} from './actionTypes';

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, ThunkableAction>;

/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId: ExploreId, index: number): AddQueryRowAction {
  const query = generateEmptyQuery(index + 1);
  return { type: ActionTypes.AddQueryRow, payload: { exploreId, index, query } };
}

/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId: ExploreId, datasource: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    const newDataSourceInstance = await getDatasourceSrv().get(datasource);
    const currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
    const modifiedQueries = getState().explore[exploreId].modifiedQueries;

    await dispatch(importQueries(exploreId, modifiedQueries, currentDataSourceInstance, newDataSourceInstance));

    dispatch(updateDatasourceInstance(exploreId, newDataSourceInstance));
    dispatch(loadDatasource(exploreId, newDataSourceInstance));
  };
}

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export function changeQuery(
  exploreId: ExploreId,
  query: DataQuery,
  index: number,
  override: boolean
): ThunkResult<void> {
  return dispatch => {
    // Null query means reset
    if (query === null) {
      query = { ...generateEmptyQuery(index) };
    }

    dispatch({ type: ActionTypes.ChangeQuery, payload: { exploreId, query, index, override } });
    if (override) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(
  exploreId: ExploreId,
  { height, width }: { height: number; width: number }
): ChangeSizeAction {
  return { type: ActionTypes.ChangeSize, payload: { exploreId, height, width } };
}

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export function changeTime(exploreId: ExploreId, range: TimeRange): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ChangeTime, payload: { exploreId, range } });
    dispatch(runQueries(exploreId));
  };
}

/**
 * Clear all queries and results.
 */
export function clearQueries(exploreId: ExploreId): ThunkResult<void> {
  return dispatch => {
    dispatch(scanStop(exploreId));
    dispatch({ type: ActionTypes.ClearQueries, payload: { exploreId } });
    dispatch(stateSave());
  };
}

/**
 * Highlight expressions in the log results
 */
export function highlightLogsExpression(exploreId: ExploreId, expressions: string[]): HighlightLogsExpressionAction {
  return { type: ActionTypes.HighlightLogsExpression, payload: { exploreId, expressions } };
}

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export function initializeExplore(
  exploreId: ExploreId,
  datasourceName: string,
  queries: DataQuery[],
  range: RawTimeRange,
  containerWidth: number,
  eventBridge: Emitter
): ThunkResult<void> {
  return async dispatch => {
    const exploreDatasources: DataSourceSelectItem[] = getDatasourceSrv()
      .getExternal()
      .map(ds => ({
        value: ds.name,
        name: ds.name,
        meta: ds.meta,
      }));

    dispatch({
      type: ActionTypes.InitializeExplore,
      payload: {
        exploreId,
        containerWidth,
        datasourceName,
        eventBridge,
        exploreDatasources,
        queries,
        range,
      },
    });

    if (exploreDatasources.length >= 1) {
      let instance;

      if (datasourceName) {
        try {
          instance = await getDatasourceSrv().get(datasourceName);
        } catch (error) {
          console.error(error);
        }
      }
      // Checking on instance here because requested datasource could be deleted already
      if (!instance) {
        instance = await getDatasourceSrv().get();
      }

      dispatch(updateDatasourceInstance(exploreId, instance));
      dispatch(loadDatasource(exploreId, instance));
    } else {
      dispatch(loadDatasourceMissing(exploreId));
    }
  };
}

/**
 * Initialize the wrapper split state
 */
export function initializeExploreSplit() {
  return async dispatch => {
    dispatch({ type: ActionTypes.InitializeExploreSplit });
  };
}

/**
 * Display an error that happened during the selection of a datasource
 */
export const loadDatasourceFailure = (exploreId: ExploreId, error: string): LoadDatasourceFailureAction => ({
  type: ActionTypes.LoadDatasourceFailure,
  payload: {
    exploreId,
    error,
  },
});

/**
 * Display an error when no datasources have been configured
 */
export const loadDatasourceMissing = (exploreId: ExploreId): LoadDatasourceMissingAction => ({
  type: ActionTypes.LoadDatasourceMissing,
  payload: { exploreId },
});

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export const loadDatasourcePending = (
  exploreId: ExploreId,
  requestedDatasourceName: string
): LoadDatasourcePendingAction => ({
  type: ActionTypes.LoadDatasourcePending,
  payload: {
    exploreId,
    requestedDatasourceName,
  },
});

export const queriesImported = (exploreId: ExploreId, queries: DataQuery[]): QueriesImported => {
  return {
    type: ActionTypes.QueriesImported,
    payload: {
      exploreId,
      queries,
    },
  };
};

/**
 * Datasource loading was successfully completed. The instance is stored in the state as well in case we need to
 * run datasource-specific code. Existing queries are imported to the new datasource if an importer exists,
 * e.g., Prometheus -> Loki queries.
 */
export const loadDatasourceSuccess = (
  exploreId: ExploreId,
  instance: any,
): LoadDatasourceSuccessAction => {
  // Capabilities
  const supportsGraph = instance.meta.metrics;
  const supportsLogs = instance.meta.logs;
  const supportsTable = instance.meta.tables;
  // Custom components
  const StartPage = instance.pluginExports.ExploreStartPage;

  const historyKey = `grafana.explore.history.${instance.meta.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource
  store.set(LAST_USED_DATASOURCE_KEY, instance.name);

  return {
    type: ActionTypes.LoadDatasourceSuccess,
    payload: {
      exploreId,
      StartPage,
      datasourceInstance: instance,
      history,
      showingStartPage: Boolean(StartPage),
      supportsGraph,
      supportsLogs,
      supportsTable,
    },
  };
};

/**
 * Updates datasource instance before datasouce loading has started
 */
export function updateDatasourceInstance(
  exploreId: ExploreId,
  instance: DataSourceApi
): UpdateDatasourceInstanceAction {
  return {
    type: ActionTypes.UpdateDatasourceInstance,
    payload: {
      exploreId,
      datasourceInstance: instance,
    },
  };
}

export function importQueries(
  exploreId: ExploreId,
  queries: DataQuery[],
  sourceDataSource: DataSourceApi,
  targetDataSource: DataSourceApi
) {
  return async dispatch => {
    let importedQueries = queries;
    // Check if queries can be imported from previously selected datasource
    if (sourceDataSource.meta.id === targetDataSource.meta.id) {
      // Keep same queries if same type of datasource
      importedQueries = [...queries];
    } else if (targetDataSource.importQueries) {
      // Datasource-specific importers
      importedQueries = await targetDataSource.importQueries(queries, sourceDataSource.meta);
    } else {
      // Default is blank queries
      importedQueries = ensureQueries();
    }

    const nextQueries = importedQueries.map((q, i) => ({
      ...importedQueries[i],
      ...generateEmptyQuery(i),
    }));

    dispatch(queriesImported(exploreId, nextQueries));
  };
}

/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export function loadDatasource(exploreId: ExploreId, instance: DataSourceApi): ThunkResult<void> {
  return async (dispatch, getState) => {
    const datasourceName = instance.name;

    // Keep ID to track selection
    dispatch(loadDatasourcePending(exploreId, datasourceName));

    let datasourceError = null;
    try {
      const testResult = await instance.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }

    if (datasourceError) {
      dispatch(loadDatasourceFailure(exploreId, datasourceError));
      return;
    }

    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
      // User already changed datasource again, discard results
      return;
    }

    if (instance.init) {
      instance.init();
    }

    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
      // User already changed datasource again, discard results
      return;
    }

    dispatch(loadDatasourceSuccess(exploreId, instance));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export function modifyQueries(
  exploreId: ExploreId,
  modification: any,
  index: number,
  modifier: any
): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ModifyQueries, payload: { exploreId, modification, index, modifier } });
    if (!modification.preventSubmit) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Mark a query transaction as failed with an error extracted from the query response.
 * The transaction will be marked as `done`.
 */
export function queryTransactionFailure(
  exploreId: ExploreId,
  transactionId: string,
  response: any,
  datasourceId: string
): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, queryTransactions } = getState().explore[exploreId];
    if (datasourceInstance.meta.id !== datasourceId || response.cancelled) {
      // Navigated away, queries did not matter
      return;
    }

    // Transaction might have been discarded
    if (!queryTransactions.find(qt => qt.id === transactionId)) {
      return;
    }

    console.error(response);

    let error: string;
    let errorDetails: string;
    if (response.data) {
      if (typeof response.data === 'string') {
        error = response.data;
      } else if (response.data.error) {
        error = response.data.error;
        if (response.data.response) {
          errorDetails = response.data.response;
        }
      } else {
        throw new Error('Could not handle error response');
      }
    } else if (response.message) {
      error = response.message;
    } else if (typeof response === 'string') {
      error = response;
    } else {
      error = 'Unknown error during query transaction. Please check JS console logs.';
    }

    // Mark transactions as complete
    const nextQueryTransactions = queryTransactions.map(qt => {
      if (qt.id === transactionId) {
        return {
          ...qt,
          error,
          errorDetails,
          done: true,
        };
      }
      return qt;
    });

    dispatch({
      type: ActionTypes.QueryTransactionFailure,
      payload: { exploreId, queryTransactions: nextQueryTransactions },
    });
  };
}

/**
 * Start a query transaction for the given result type.
 * @param exploreId Explore area
 * @param transaction Query options and `done` status.
 * @param resultType Associate the transaction with a result viewer, e.g., Graph
 * @param rowIndex Index is used to associate latency for this transaction with a query row
 */
export function queryTransactionStart(
  exploreId: ExploreId,
  transaction: QueryTransaction,
  resultType: ResultType,
  rowIndex: number
): QueryTransactionStartAction {
  return { type: ActionTypes.QueryTransactionStart, payload: { exploreId, resultType, rowIndex, transaction } };
}

/**
 * Complete a query transaction, mark the transaction as `done` and store query state in URL.
 * If the transaction was started by a scanner, it keeps on scanning for more results.
 * Side-effect: the query is stored in localStorage.
 * @param exploreId Explore area
 * @param transactionId ID
 * @param result Response from `datasourceInstance.query()`
 * @param latency Duration between request and response
 * @param queries Queries from all query rows
 * @param datasourceId Origin datasource instance, used to discard results if current datasource is different
 */
export function queryTransactionSuccess(
  exploreId: ExploreId,
  transactionId: string,
  result: any,
  latency: number,
  queries: DataQuery[],
  datasourceId: string
): ThunkResult<void> {
  return (dispatch, getState) => {
    const { datasourceInstance, history, queryTransactions, scanner, scanning } = getState().explore[exploreId];

    // If datasource already changed, results do not matter
    if (datasourceInstance.meta.id !== datasourceId) {
      return;
    }

    // Transaction might have been discarded
    const transaction = queryTransactions.find(qt => qt.id === transactionId);
    if (!transaction) {
      return;
    }

    // Get query hints
    let hints: QueryHint[];
    if (datasourceInstance.getQueryHints) {
      hints = datasourceInstance.getQueryHints(transaction.query, result);
    }

    // Mark transactions as complete and attach result
    const nextQueryTransactions = queryTransactions.map(qt => {
      if (qt.id === transactionId) {
        return {
          ...qt,
          hints,
          latency,
          result,
          done: true,
        };
      }
      return qt;
    });

    // Side-effect: Saving history in localstorage
    const nextHistory = updateHistory(history, datasourceId, queries);

    dispatch({
      type: ActionTypes.QueryTransactionSuccess,
      payload: {
        exploreId,
        history: nextHistory,
        queryTransactions: nextQueryTransactions,
      },
    });

    // Keep scanning for results if this was the last scanning transaction
    if (scanning) {
      if (_.size(result) === 0) {
        const other = nextQueryTransactions.find(qt => qt.scanning && !qt.done);
        if (!other) {
          const range = scanner();
          dispatch({ type: ActionTypes.ScanRange, payload: { exploreId, range } });
        }
      } else {
        // We can stop scanning if we have a result
        dispatch(scanStop(exploreId));
      }
    }
  };
}

/**
 * Remove query row of the given index, as well as associated query results.
 */
export function removeQueryRow(exploreId: ExploreId, index: number): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.RemoveQueryRow, payload: { exploreId, index } });
    dispatch(runQueries(exploreId));
  };
}

/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export function runQueries(exploreId: ExploreId) {
  return (dispatch, getState) => {
    const {
      datasourceInstance,
      modifiedQueries,
      showingLogs,
      showingGraph,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
    } = getState().explore[exploreId];

    if (!hasNonEmptyQuery(modifiedQueries)) {
      dispatch({ type: ActionTypes.RunQueriesEmpty, payload: { exploreId } });
      dispatch(stateSave()); // Remember to saves to state and update location
      return;
    }

    // Some datasource's query builders allow per-query interval limits,
    // but we're using the datasource interval limit for now
    const interval = datasourceInstance.interval;

    // Keep table queries first since they need to return quickly
    if (showingTable && supportsTable) {
      dispatch(
        runQueriesForType(
          exploreId,
          'Table',
          {
            interval,
            format: 'table',
            instant: true,
            valueWithRefId: true,
          },
          data => data[0]
        )
      );
    }
    if (showingGraph && supportsGraph) {
      dispatch(
        runQueriesForType(
          exploreId,
          'Graph',
          {
            interval,
            format: 'time_series',
            instant: false,
          },
          makeTimeSeriesList
        )
      );
    }
    if (showingLogs && supportsLogs) {
      dispatch(runQueriesForType(exploreId, 'Logs', { interval, format: 'logs' }));
    }
    dispatch(stateSave());
  };
}

/**
 * Helper action to build a query transaction object and handing the query to the datasource.
 * @param exploreId Explore area
 * @param resultType Result viewer that will be associated with this query result
 * @param queryOptions Query options as required by the datasource's `query()` function.
 * @param resultGetter Optional result extractor, e.g., if the result is a list and you only need the first element.
 */
function runQueriesForType(
  exploreId: ExploreId,
  resultType: ResultType,
  queryOptions: QueryOptions,
  resultGetter?: any
) {
  return async (dispatch, getState) => {
    const {
      datasourceInstance,
      eventBridge,
      modifiedQueries: queries,
      queryIntervals,
      range,
      scanning,
    } = getState().explore[exploreId];
    const datasourceId = datasourceInstance.meta.id;

    // Run all queries concurrently
    queries.forEach(async (query, rowIndex) => {
      const transaction = buildQueryTransaction(
        query,
        rowIndex,
        resultType,
        queryOptions,
        range,
        queryIntervals,
        scanning
      );
      dispatch(queryTransactionStart(exploreId, transaction, resultType, rowIndex));
      try {
        const now = Date.now();
        const res = await datasourceInstance.query(transaction.options);
        eventBridge.emit('data-received', res.data || []);
        const latency = Date.now() - now;
        const results = resultGetter ? resultGetter(res.data) : res.data;
        dispatch(queryTransactionSuccess(exploreId, transaction.id, results, latency, queries, datasourceId));
      } catch (response) {
        eventBridge.emit('data-error', response);
        dispatch(queryTransactionFailure(exploreId, transaction.id, response, datasourceId));
      }
    });
  };
}

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId: ExploreId, scanner: RangeScanner): ThunkResult<void> {
  return dispatch => {
    // Register the scanner
    dispatch({ type: ActionTypes.ScanStart, payload: { exploreId, scanner } });
    // Scanning must trigger query run, and return the new range
    const range = scanner();
    // Set the new range to be displayed
    dispatch({ type: ActionTypes.ScanRange, payload: { exploreId, range } });
  };
}

/**
 * Stop any scanning for more results.
 */
export function scanStop(exploreId: ExploreId): ScanStopAction {
  return { type: ActionTypes.ScanStop, payload: { exploreId } };
}

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId: ExploreId, rawQueries: DataQuery[]): ThunkResult<void> {
  return dispatch => {
    // Inject react keys into query objects
    const queries = rawQueries.map(q => ({ ...q, ...generateEmptyQuery() }));
    dispatch({
      type: ActionTypes.SetQueries,
      payload: {
        exploreId,
        queries,
      },
    });
    dispatch(runQueries(exploreId));
  };
}

/**
 * Close the split view and save URL state.
 */
export function splitClose(): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.SplitClose });
    dispatch(stateSave());
  };
}

/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export function splitOpen(): ThunkResult<void> {
  return (dispatch, getState) => {
    // Clone left state to become the right state
    const leftState = getState().explore.left;
    const itemState = {
      ...leftState,
      queryTransactions: [],
      initialQueries: leftState.modifiedQueries.slice(),
    };
    dispatch({ type: ActionTypes.SplitOpen, payload: { itemState } });
    dispatch(stateSave());
  };
}

/**
 * Saves Explore state to URL using the `left` and `right` parameters.
 * If split view is not active, `right` will not be set.
 */
export function stateSave() {
  return (dispatch, getState) => {
    const { left, right, split } = getState().explore;
    const urlStates: { [index: string]: string } = {};
    const leftUrlState: ExploreUrlState = {
      datasource: left.datasourceInstance.name,
      queries: left.modifiedQueries.map(clearQueryKeys),
      range: left.range,
    };
    urlStates.left = serializeStateToUrlParam(leftUrlState, true);
    if (split) {
      const rightUrlState: ExploreUrlState = {
        datasource: right.datasourceInstance.name,
        queries: right.modifiedQueries.map(clearQueryKeys),
        range: right.range,
      };
      urlStates.right = serializeStateToUrlParam(rightUrlState, true);
    }
    dispatch(updateLocation({ query: urlStates }));
  };
}

/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export function toggleGraph(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ToggleGraph, payload: { exploreId } });
    if (getState().explore[exploreId].showingGraph) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Expand/collapse the logs result viewer. When collapsed, log queries won't be run.
 */
export function toggleLogs(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ToggleLogs, payload: { exploreId } });
    if (getState().explore[exploreId].showingLogs) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export function toggleTable(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    dispatch({ type: ActionTypes.ToggleTable, payload: { exploreId } });
    if (getState().explore[exploreId].showingTable) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Resets state for explore.
 */
export function resetExplore(): ThunkResult<void> {
  return dispatch => {
    dispatch({ type: ActionTypes.ResetExplore, payload: {} });
  };
}
