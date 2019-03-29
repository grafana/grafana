// Libraries
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
import {
  RawTimeRange,
  TimeRange,
  DataSourceApi,
  DataQuery,
  DataSourceSelectItem,
  QueryHint,
  QueryFixAction,
} from '@grafana/ui/src/types';
import { ExploreId, ExploreUrlState, RangeScanner, ResultType, QueryOptions, ExploreUIState } from 'app/types/explore';
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
  loadDatasourceFailureAction,
  loadDatasourcePendingAction,
  queriesImportedAction,
  LoadDatasourceSuccessPayload,
  loadDatasourceSuccessAction,
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
} from './actionTypes';
import { ActionOf, ActionCreator } from 'app/core/redux/actionCreatorFactory';
import { LogsDedupStrategy } from 'app/core/logs_model';
import { ThunkResult } from 'app/types';
import { parseTime } from '../TimePicker';

/**
 * Updates UI state and save it to the URL
 */
const updateExploreUIState = (exploreId, uiStateFragment: Partial<ExploreUIState>) => {
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
    const newDataSourceInstance = await getDatasourceSrv().get(datasource);
    const currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
    const queries = getState().explore[exploreId].queries;

    await dispatch(importQueries(exploreId, queries, currentDataSourceInstance, newDataSourceInstance));

    dispatch(updateDatasourceInstanceAction({ exploreId, datasourceInstance: newDataSourceInstance }));

    try {
      await dispatch(loadDatasource(exploreId, newDataSourceInstance));
    } catch (error) {
      console.error(error);
      return;
    }

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
    const exploreDatasources: DataSourceSelectItem[] = getDatasourceSrv()
      .getExternal()
      .map(ds => ({
        value: ds.name,
        name: ds.name,
        meta: ds.meta,
      }));

    dispatch(
      initializeExploreAction({
        exploreId,
        containerWidth,
        eventBridge,
        exploreDatasources,
        queries,
        range,
        ui,
      })
    );

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

      dispatch(updateDatasourceInstanceAction({ exploreId, datasourceInstance: instance }));

      try {
        await dispatch(loadDatasource(exploreId, instance));
      } catch (error) {
        console.error(error);
        return;
      }
      dispatch(runQueries(exploreId, true));
    } else {
      dispatch(loadDatasourceMissingAction({ exploreId }));
    }
  };
}

/**
 * Datasource loading was successfully completed. The instance is stored in the state as well in case we need to
 * run datasource-specific code. Existing queries are imported to the new datasource if an importer exists,
 * e.g., Prometheus -> Loki queries.
 */
export const loadDatasourceSuccess = (exploreId: ExploreId, instance: any): ActionOf<LoadDatasourceSuccessPayload> => {
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

  return loadDatasourceSuccessAction({
    exploreId,
    StartPage,
    datasourceInstance: instance,
    history,
    showingStartPage: Boolean(StartPage),
    supportsGraph,
    supportsLogs,
    supportsTable,
  });
};

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
      ...q,
      ...generateEmptyQuery(queries),
    }));

    dispatch(queriesImportedAction({ exploreId, queries: nextQueries }));
  };
}

/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export function loadDatasource(exploreId: ExploreId, instance: DataSourceApi): ThunkResult<void> {
  return async (dispatch, getState) => {
    const datasourceName = instance.name;

    // Keep ID to track selection
    dispatch(loadDatasourcePendingAction({ exploreId, requestedDatasourceName: datasourceName }));
    let datasourceError = null;

    try {
      const testResult = await instance.testDatasource();
      datasourceError = testResult.status === 'success' ? null : testResult.message;
    } catch (error) {
      datasourceError = (error && error.statusText) || 'Network error';
    }

    if (datasourceError) {
      dispatch(loadDatasourceFailureAction({ exploreId, error: datasourceError }));
      return Promise.reject(`${datasourceName} loading failed`);
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
    return Promise.resolve();
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
export function runQueries(exploreId: ExploreId, ignoreUIState = false) {
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
    } = getState().explore[exploreId];

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
          data => data[0]
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
) {
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
    const itemState = {
      ...leftState,
      queryTransactions: [],
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
export function stateSave() {
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
) => (exploreId: ExploreId, isPanelVisible: boolean) => {
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
export const changeDedupStrategy = (exploreId, dedupStrategy: LogsDedupStrategy) => {
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
