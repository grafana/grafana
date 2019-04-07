// Libraries
// @ts-ignore
import _ from 'lodash';

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
  parseUrlState,
} from 'app/core/utils/explore';

// Actions
import { updateLocation } from 'app/core/actions';

// Types
import { ThunkResult } from 'app/types';
import {
  RawTimeRange,
  TimeRange,
  DataSourceApi,
  DataQuery,
  DataSourceSelectItem,
  QueryHint,
  QueryFixAction,
} from '@grafana/ui/src/types';
import {
  ExploreId,
  ExploreUrlState,
  RangeScanner,
  ResultType,
  QueryOptions,
  ExploreUIState,
  QueryTransaction,
} from 'app/types/explore';
import {
  updateDatasourceInstanceAction,
  changeQueryAction,
  changeSizeAction,
  ChangeSizePayload,
  changeTimeAction,
  scanStopAction,
  clearQueriesAction,
  initializeExploreAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  queriesImportedAction,
  LoadDatasourceReadyPayload,
  loadDatasourceReadyAction,
  modifyQueriesAction,
  queryTransactionFailureAction,
  queryTransactionStartAction,
  queryTransactionSuccessAction,
  scanRangeAction,
  scanStartAction,
  setQueriesAction,
  splitCloseAction,
  splitOpenAction,
  addQueryRowAction,
  toggleGraphAction,
  toggleLogsAction,
  toggleTableAction,
  ToggleGraphPayload,
  ToggleLogsPayload,
  ToggleTablePayload,
  updateUIStateAction,
  runQueriesAction,
  testDataSourcePendingAction,
  testDataSourceSuccessAction,
  testDataSourceFailureAction,
  loadExploreDatasources,
} from './actionTypes';
import { ActionOf, ActionCreator } from 'app/core/redux/actionCreatorFactory';
import { LogsDedupStrategy } from 'app/core/logs_model';
import { parseTime } from '../TimePicker';

/**
 * Updates UI state and save it to the URL
 */
const updateExploreUIState = (exploreId: ExploreId, uiStateFragment: Partial<ExploreUIState>): ThunkResult<void> => {
  return dispatch => {
    dispatch(updateUIStateAction({ exploreId, ...uiStateFragment }));
    dispatch(stateSave());
  };
};

/**
 * Adds a query row after the row with the given index.
 */
export function addQueryRow(exploreId: ExploreId, index: number): ThunkResult<void> {
  return (dispatch, getState) => {
    const query = generateEmptyQuery(getState().explore[exploreId].queries, index);

    dispatch(addQueryRowAction({ exploreId, index, query }));
  };
}

/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId: ExploreId, datasource: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    let newDataSourceInstance: DataSourceApi = null;

    if (!datasource) {
      newDataSourceInstance = await getDatasourceSrv().get();
    } else {
      newDataSourceInstance = await getDatasourceSrv().get(datasource);
    }

    const currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
    const queries = getState().explore[exploreId].queries;

    await dispatch(importQueries(exploreId, queries, currentDataSourceInstance, newDataSourceInstance));

    dispatch(updateDatasourceInstanceAction({ exploreId, datasourceInstance: newDataSourceInstance }));

    await dispatch(loadDatasource(exploreId, newDataSourceInstance));

    dispatch(runQueries(exploreId));
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
  return (dispatch, getState) => {
    // Null query means reset
    if (query === null) {
      query = { ...generateEmptyQuery(getState().explore[exploreId].queries) };
    }

    dispatch(changeQueryAction({ exploreId, query, index, override }));
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
): ActionOf<ChangeSizePayload> {
  return changeSizeAction({ exploreId, height, width });
}

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export function changeTime(exploreId: ExploreId, range: TimeRange): ThunkResult<void> {
  return dispatch => {
    dispatch(changeTimeAction({ exploreId, range }));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Clear all queries and results.
 */
export function clearQueries(exploreId: ExploreId): ThunkResult<void> {
  return dispatch => {
    dispatch(scanStopAction({ exploreId }));
    dispatch(clearQueriesAction({ exploreId }));
    dispatch(stateSave());
  };
}

/**
 * Loads all explore data sources and sets the chosen datasource.
 * If there are no datasources a missing datasource action is dispatched.
 */
export function loadExploreDatasourcesAndSetDatasource(
  exploreId: ExploreId,
  datasourceName: string
): ThunkResult<void> {
  return dispatch => {
    const exploreDatasources: DataSourceSelectItem[] = getDatasourceSrv()
      .getExternal()
      .map((ds: any) => ({
        value: ds.name,
        name: ds.name,
        meta: ds.meta,
      }));

    dispatch(loadExploreDatasources({ exploreId, exploreDatasources }));

    if (exploreDatasources.length >= 1) {
      dispatch(changeDatasource(exploreId, datasourceName));
    } else {
      dispatch(loadDatasourceMissingAction({ exploreId }));
    }
  };
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
  eventBridge: Emitter,
  ui: ExploreUIState
): ThunkResult<void> {
  return async dispatch => {
    dispatch(loadExploreDatasourcesAndSetDatasource(exploreId, datasourceName));
    dispatch(
      initializeExploreAction({
        exploreId,
        containerWidth,
        eventBridge,
        queries,
        range,
        ui,
      })
    );
  };
}

/**
 * Datasource loading was successfully completed.
 */
export const loadDatasourceReady = (
  exploreId: ExploreId,
  instance: DataSourceApi
): ActionOf<LoadDatasourceReadyPayload> => {
  const historyKey = `grafana.explore.history.${instance.meta.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource
  store.set(LAST_USED_DATASOURCE_KEY, instance.name);

  return loadDatasourceReadyAction({
    exploreId,
    history,
  });
};

export function importQueries(
  exploreId: ExploreId,
  queries: DataQuery[],
  sourceDataSource: DataSourceApi,
  targetDataSource: DataSourceApi
): ThunkResult<void> {
  return async dispatch => {
    if (!sourceDataSource) {
      // explore not initialized
      dispatch(queriesImportedAction({ exploreId, queries }));
      return;
    }

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
      ...q,
      ...generateEmptyQuery(queries),
    }));

    dispatch(queriesImportedAction({ exploreId, queries: nextQueries }));
  };
}

/**
 * Tests datasource.
 */
export const testDatasource = (exploreId: ExploreId, instance: DataSourceApi): ThunkResult<void> => {
  return async dispatch => {
    let datasourceError = null;

    dispatch(testDataSourcePendingAction({ exploreId }));

    try {
      const testResult = await instance.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }

    if (datasourceError) {
      dispatch(testDataSourceFailureAction({ exploreId, error: datasourceError }));
      return;
    }

    dispatch(testDataSourceSuccessAction({ exploreId }));
  };
};

/**
 * Reconnects datasource when there is a connection failure.
 */
export const reconnectDatasource = (exploreId: ExploreId): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const instance = getState().explore[exploreId].datasourceInstance;
    dispatch(changeDatasource(exploreId, instance.name));
  };
};

/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export function loadDatasource(exploreId: ExploreId, instance: DataSourceApi): ThunkResult<void> {
  return async (dispatch, getState) => {
    const datasourceName = instance.name;

    // Keep ID to track selection
    dispatch(loadDatasourcePendingAction({ exploreId, requestedDatasourceName: datasourceName }));

    await dispatch(testDatasource(exploreId, instance));

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

    dispatch(loadDatasourceReady(exploreId, instance));
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
  modification: QueryFixAction,
  index: number,
  modifier: any
): ThunkResult<void> {
  return dispatch => {
    dispatch(modifyQueriesAction({ exploreId, modification, index, modifier }));
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

    dispatch(queryTransactionFailureAction({ exploreId, queryTransactions: nextQueryTransactions }));
  };
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

    dispatch(
      queryTransactionSuccessAction({
        exploreId,
        history: nextHistory,
        queryTransactions: nextQueryTransactions,
      })
    );

    // Keep scanning for results if this was the last scanning transaction
    if (scanning) {
      if (_.size(result) === 0) {
        const other = nextQueryTransactions.find(qt => qt.scanning && !qt.done);
        if (!other) {
          const range = scanner();
          dispatch(scanRangeAction({ exploreId, range }));
        }
      } else {
        // We can stop scanning if we have a result
        dispatch(scanStopAction({ exploreId }));
      }
    }
  };
}

/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export function runQueries(exploreId: ExploreId, ignoreUIState = false): ThunkResult<void> {
  return (dispatch, getState) => {
    const {
      datasourceInstance,
      queries,
      showingLogs,
      showingGraph,
      showingTable,
      supportsGraph,
      supportsLogs,
      supportsTable,
      datasourceError,
    } = getState().explore[exploreId];

    if (datasourceError) {
      // let's not run any queries if data source is in a faulty state
      return;
    }

    if (!hasNonEmptyQuery(queries)) {
      dispatch(clearQueriesAction({ exploreId }));
      dispatch(stateSave()); // Remember to saves to state and update location
      return;
    }

    // Some datasource's query builders allow per-query interval limits,
    // but we're using the datasource interval limit for now
    const interval = datasourceInstance.interval;

    dispatch(runQueriesAction());
    // Keep table queries first since they need to return quickly
    if ((ignoreUIState || showingTable) && supportsTable) {
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
          (data: any) => data[0]
        )
      );
    }
    if ((ignoreUIState || showingGraph) && supportsGraph) {
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
    if ((ignoreUIState || showingLogs) && supportsLogs) {
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
): ThunkResult<void> {
  return async (dispatch, getState) => {
    const { datasourceInstance, eventBridge, queries, queryIntervals, range, scanning } = getState().explore[exploreId];
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
      dispatch(queryTransactionStartAction({ exploreId, resultType, rowIndex, transaction }));
      try {
        const now = Date.now();
        const res = await datasourceInstance.query(transaction.options);
        eventBridge.emit('data-received', res.data || []);
        const latency = Date.now() - now;
        const { queryTransactions } = getState().explore[exploreId];
        const results = resultGetter ? resultGetter(res.data, transaction, queryTransactions) : res.data;
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
    dispatch(scanStartAction({ exploreId, scanner }));
    // Scanning must trigger query run, and return the new range
    const range = scanner();
    // Set the new range to be displayed
    dispatch(scanRangeAction({ exploreId, range }));
  };
}

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId: ExploreId, rawQueries: DataQuery[]): ThunkResult<void> {
  return (dispatch, getState) => {
    // Inject react keys into query objects
    const queries = rawQueries.map(q => ({ ...q, ...generateEmptyQuery(getState().explore[exploreId].queries) }));
    dispatch(setQueriesAction({ exploreId, queries }));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Close the split view and save URL state.
 */
export function splitClose(itemId: ExploreId): ThunkResult<void> {
  return dispatch => {
    dispatch(splitCloseAction({ itemId }));
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
    const leftState = getState().explore[ExploreId.left];
    const queryState = getState().location.query[ExploreId.left] as string;
    const urlState = parseUrlState(queryState);
    const queryTransactions: QueryTransaction[] = [];
    const itemState = {
      ...leftState,
      queryTransactions,
      queries: leftState.queries.slice(),
      exploreId: ExploreId.right,
      urlState,
    };
    dispatch(splitOpenAction({ itemState }));
    dispatch(stateSave());
  };
}

/**
 * Saves Explore state to URL using the `left` and `right` parameters.
 * If split view is not active, `right` will not be set.
 */
export function stateSave(): ThunkResult<void> {
  return (dispatch, getState) => {
    const { left, right, split } = getState().explore;
    const urlStates: { [index: string]: string } = {};
    const leftUrlState: ExploreUrlState = {
      datasource: left.datasourceInstance.name,
      queries: left.queries.map(clearQueryKeys),
      range: left.range,
      ui: {
        showingGraph: left.showingGraph,
        showingLogs: left.showingLogs,
        showingTable: left.showingTable,
        dedupStrategy: left.dedupStrategy,
      },
    };
    urlStates.left = serializeStateToUrlParam(leftUrlState, true);
    if (split) {
      const rightUrlState: ExploreUrlState = {
        datasource: right.datasourceInstance.name,
        queries: right.queries.map(clearQueryKeys),
        range: right.range,
        ui: {
          showingGraph: right.showingGraph,
          showingLogs: right.showingLogs,
          showingTable: right.showingTable,
          dedupStrategy: right.dedupStrategy,
        },
      };

      urlStates.right = serializeStateToUrlParam(rightUrlState, true);
    }

    dispatch(updateLocation({ query: urlStates }));
  };
}

/**
 * Creates action to collapse graph/logs/table panel. When panel is collapsed,
 * queries won't be run
 */
const togglePanelActionCreator = (
  actionCreator:
    | ActionCreator<ToggleGraphPayload>
    | ActionCreator<ToggleLogsPayload>
    | ActionCreator<ToggleTablePayload>
) => (exploreId: ExploreId, isPanelVisible: boolean): ThunkResult<void> => {
  return dispatch => {
    let uiFragmentStateUpdate: Partial<ExploreUIState>;
    const shouldRunQueries = !isPanelVisible;

    switch (actionCreator.type) {
      case toggleGraphAction.type:
        uiFragmentStateUpdate = { showingGraph: !isPanelVisible };
        break;
      case toggleLogsAction.type:
        uiFragmentStateUpdate = { showingLogs: !isPanelVisible };
        break;
      case toggleTableAction.type:
        uiFragmentStateUpdate = { showingTable: !isPanelVisible };
        break;
    }

    dispatch(actionCreator({ exploreId }));
    dispatch(updateExploreUIState(exploreId, uiFragmentStateUpdate));

    if (shouldRunQueries) {
      dispatch(runQueries(exploreId));
    }
  };
};

/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export const toggleGraph = togglePanelActionCreator(toggleGraphAction);

/**
 * Expand/collapse the logs result viewer. When collapsed, log queries won't be run.
 */
export const toggleLogs = togglePanelActionCreator(toggleLogsAction);

/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export const toggleTable = togglePanelActionCreator(toggleTableAction);

/**
 * Change logs deduplication strategy and update URL.
 */
export const changeDedupStrategy = (exploreId: ExploreId, dedupStrategy: LogsDedupStrategy): ThunkResult<void> => {
  return dispatch => {
    dispatch(updateExploreUIState(exploreId, { dedupStrategy }));
  };
};

export function refreshExplore(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    const itemState = getState().explore[exploreId];
    if (!itemState.initialized) {
      return;
    }

    const { urlState, update, containerWidth, eventBridge } = itemState;
    const { datasource, queries, range, ui } = urlState;
    const refreshQueries = queries.map(q => ({ ...q, ...generateEmptyQuery(itemState.queries) }));
    const refreshRange = { from: parseTime(range.from), to: parseTime(range.to) };

    // need to refresh datasource
    if (update.datasource) {
      const initialQueries = ensureQueries(queries);
      const initialRange = { from: parseTime(range.from), to: parseTime(range.to) };
      dispatch(initializeExplore(exploreId, datasource, initialQueries, initialRange, containerWidth, eventBridge, ui));
      return;
    }

    if (update.range) {
      dispatch(changeTimeAction({ exploreId, range: refreshRange as TimeRange }));
    }

    // need to refresh ui state
    if (update.ui) {
      dispatch(updateUIStateAction({ ...ui, exploreId }));
    }

    // need to refresh queries
    if (update.queries) {
      dispatch(setQueriesAction({ exploreId, queries: refreshQueries }));
    }

    // always run queries when refresh is needed
    if (update.queries || update.ui || update.range) {
      dispatch(runQueries(exploreId));
    }
  };
}
