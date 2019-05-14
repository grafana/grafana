import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
/**  Higher order actions
 *
 */
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["InitializeExploreSplit"] = "explore/INITIALIZE_EXPLORE_SPLIT";
    ActionTypes["SplitClose"] = "explore/SPLIT_CLOSE";
    ActionTypes["SplitOpen"] = "explore/SPLIT_OPEN";
    ActionTypes["ResetExplore"] = "explore/RESET_EXPLORE";
})(ActionTypes || (ActionTypes = {}));
/**
 * Adds a query row after the row with the given index.
 */
export var addQueryRowAction = actionCreatorFactory('explore/ADD_QUERY_ROW').create();
/**
 * Loads a new datasource identified by the given name.
 */
export var changeDatasourceAction = noPayloadActionCreatorFactory('explore/CHANGE_DATASOURCE').create();
/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export var changeQueryAction = actionCreatorFactory('explore/CHANGE_QUERY').create();
/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export var changeSizeAction = actionCreatorFactory('explore/CHANGE_SIZE').create();
/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export var changeTimeAction = actionCreatorFactory('explore/CHANGE_TIME').create();
/**
 * Clear all queries and results.
 */
export var clearQueriesAction = actionCreatorFactory('explore/CLEAR_QUERIES').create();
/**
 * Highlight expressions in the log results
 */
export var highlightLogsExpressionAction = actionCreatorFactory('explore/HIGHLIGHT_LOGS_EXPRESSION').create();
/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export var initializeExploreAction = actionCreatorFactory('explore/INITIALIZE_EXPLORE').create();
/**
 * Initialize the wrapper split state
 */
export var initializeExploreSplitAction = noPayloadActionCreatorFactory('explore/INITIALIZE_EXPLORE_SPLIT').create();
/**
 * Display an error that happened during the selection of a datasource
 */
export var loadDatasourceFailureAction = actionCreatorFactory('explore/LOAD_DATASOURCE_FAILURE').create();
/**
 * Display an error when no datasources have been configured
 */
export var loadDatasourceMissingAction = actionCreatorFactory('explore/LOAD_DATASOURCE_MISSING').create();
/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export var loadDatasourcePendingAction = actionCreatorFactory('explore/LOAD_DATASOURCE_PENDING').create();
/**
 * Datasource loading was successfully completed. The instance is stored in the state as well in case we need to
 * run datasource-specific code. Existing queries are imported to the new datasource if an importer exists,
 * e.g., Prometheus -> Loki queries.
 */
export var loadDatasourceSuccessAction = actionCreatorFactory('explore/LOAD_DATASOURCE_SUCCESS').create();
/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export var modifyQueriesAction = actionCreatorFactory('explore/MODIFY_QUERIES').create();
/**
 * Mark a query transaction as failed with an error extracted from the query response.
 * The transaction will be marked as `done`.
 */
export var queryTransactionFailureAction = actionCreatorFactory('explore/QUERY_TRANSACTION_FAILURE').create();
/**
 * Start a query transaction for the given result type.
 * @param exploreId Explore area
 * @param transaction Query options and `done` status.
 * @param resultType Associate the transaction with a result viewer, e.g., Graph
 * @param rowIndex Index is used to associate latency for this transaction with a query row
 */
export var queryTransactionStartAction = actionCreatorFactory('explore/QUERY_TRANSACTION_START').create();
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
export var queryTransactionSuccessAction = actionCreatorFactory('explore/QUERY_TRANSACTION_SUCCESS').create();
/**
 * Remove query row of the given index, as well as associated query results.
 */
export var removeQueryRowAction = actionCreatorFactory('explore/REMOVE_QUERY_ROW').create();
export var runQueriesAction = noPayloadActionCreatorFactory('explore/RUN_QUERIES').create();
export var runQueriesEmptyAction = actionCreatorFactory('explore/RUN_QUERIES_EMPTY').create();
/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export var scanStartAction = actionCreatorFactory('explore/SCAN_START').create();
export var scanRangeAction = actionCreatorFactory('explore/SCAN_RANGE').create();
/**
 * Stop any scanning for more results.
 */
export var scanStopAction = actionCreatorFactory('explore/SCAN_STOP').create();
/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export var setQueriesAction = actionCreatorFactory('explore/SET_QUERIES').create();
/**
 * Close the split view and save URL state.
 */
export var splitCloseAction = noPayloadActionCreatorFactory('explore/SPLIT_CLOSE').create();
/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export var splitOpenAction = actionCreatorFactory('explore/SPLIT_OPEN').create();
export var stateSaveAction = noPayloadActionCreatorFactory('explore/STATE_SAVE').create();
/**
 * Update state of Explores UI elements (panels visiblity and deduplication  strategy)
 */
export var updateUIStateAction = actionCreatorFactory('explore/UPDATE_UI_STATE').create();
/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export var toggleTableAction = actionCreatorFactory('explore/TOGGLE_TABLE').create();
/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export var toggleGraphAction = actionCreatorFactory('explore/TOGGLE_GRAPH').create();
/**
 * Expand/collapse the logs result viewer. When collapsed, log queries won't be run.
 */
export var toggleLogsAction = actionCreatorFactory('explore/TOGGLE_LOGS').create();
/**
 * Updates datasource instance before datasouce loading has started
 */
export var updateDatasourceInstanceAction = actionCreatorFactory('explore/UPDATE_DATASOURCE_INSTANCE').create();
export var toggleLogLevelAction = actionCreatorFactory('explore/TOGGLE_LOG_LEVEL').create();
/**
 * Resets state for explore.
 */
export var resetExploreAction = noPayloadActionCreatorFactory('explore/RESET_EXPLORE').create();
export var queriesImportedAction = actionCreatorFactory('explore/QueriesImported').create();
//# sourceMappingURL=actionTypes.js.map