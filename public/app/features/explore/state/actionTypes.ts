// Types
import { Emitter } from 'app/core/core';
import {
  RawTimeRange,
  TimeRange,
  DataQuery,
  DataSourceSelectItem,
  DataSourceApi,
  QueryFixAction,
} from '@grafana/ui/src/types';
import {
  ExploreItemState,
  HistoryItem,
  RangeScanner,
  ResultType,
  QueryTransaction,
  ExploreUIState,
} from 'app/types/explore';
import {
  actionCreatorFactory,
  noPayloadActionCreatorFactory,
  ActionOf,
  higherOrderActionCreatorFactory,
  noPayloadHigherOrderActionCreatorFactory,
} from 'app/core/redux/actionCreatorFactory';
import { LogLevel } from 'app/core/logs_model';

/**  Higher order actions
 *
 */
export enum ActionTypes {
  InitializeExploreSplit = 'explore/INITIALIZE_EXPLORE_SPLIT',
  SplitClose = 'explore/SPLIT_CLOSE',
  SplitOpen = 'explore/SPLIT_OPEN',
  ResetExplore = 'explore/RESET_EXPLORE',
}

export interface InitializeExploreSplitAction {
  type: ActionTypes.InitializeExploreSplit;
  id?: string;
  payload: {};
}

export interface SplitCloseAction {
  type: ActionTypes.SplitClose;
  id?: string;
  payload: {};
}

export interface SplitOpenAction {
  type: ActionTypes.SplitOpen;
  id?: string;
  payload: {
    itemState: ExploreItemState;
  };
}

export interface ResetExploreAction {
  type: ActionTypes.ResetExplore;
  id?: string;
  payload: {};
}

/**  Lower order actions
 *
 */
export interface AddQueryRowPayload {
  index: number;
  query: DataQuery;
}

export interface ChangeQueryPayload {
  query: DataQuery;
  index: number;
  override: boolean;
}

export interface ChangeSizePayload {
  width: number;
  height: number;
}

export interface ChangeTimePayload {
  range: TimeRange;
}

export interface HighlightLogsExpressionPayload {
  expressions: string[];
}

export interface InitializeExplorePayload {
  containerWidth: number;
  eventBridge: Emitter;
  exploreDatasources: DataSourceSelectItem[];
  queries: DataQuery[];
  range: RawTimeRange;
  ui: ExploreUIState;
}

export interface LoadDatasourceFailurePayload {
  error: string;
}

export interface LoadDatasourcePendingPayload {
  requestedDatasourceName: string;
}

export interface LoadDatasourceSuccessPayload {
  StartPage?: any;
  datasourceInstance: any;
  history: HistoryItem[];
  logsHighlighterExpressions?: any[];
  showingStartPage: boolean;
  supportsGraph: boolean;
  supportsLogs: boolean;
  supportsTable: boolean;
}

export interface ModifyQueriesPayload {
  modification: QueryFixAction;
  index: number;
  modifier: (query: DataQuery, modification: QueryFixAction) => DataQuery;
}

export interface QueryTransactionFailurePayload {
  queryTransactions: QueryTransaction[];
}

export interface QueryTransactionStartPayload {
  resultType: ResultType;
  rowIndex: number;
  transaction: QueryTransaction;
}

export interface QueryTransactionSuccessPayload {
  history: HistoryItem[];
  queryTransactions: QueryTransaction[];
}

export interface RemoveQueryRowPayload {
  index: number;
}

export interface ScanStartPayload {
  scanner: RangeScanner;
}

export interface ScanRangePayload {
  range: RawTimeRange;
}

export interface SetQueriesPayload {
  queries: DataQuery[];
}

export interface SplitOpenPayload {
  itemState: ExploreItemState;
}

export interface UpdateUIStatePayload extends Partial<ExploreUIState> {}

export interface UpdateDatasourceInstancePayload {
  datasourceInstance: DataSourceApi;
}

export interface ToggleLogLevelPayload {
  hiddenLogLevels: Set<LogLevel>;
}

export interface QueriesImportedPayload {
  queries: DataQuery[];
}

/**
 * Adds a query row after the row with the given index.
 */
export const addQueryRowAction = higherOrderActionCreatorFactory<AddQueryRowPayload>('explore/ADD_QUERY_ROW').create();

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export const changeQueryAction = higherOrderActionCreatorFactory<ChangeQueryPayload>('explore/CHANGE_QUERY').create();

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export const changeSizeAction = higherOrderActionCreatorFactory<ChangeSizePayload>('explore/CHANGE_SIZE').create();

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export const changeTimeAction = higherOrderActionCreatorFactory<ChangeTimePayload>('explore/CHANGE_TIME').create();

/**
 * Clear all queries and results.
 */
export const clearQueriesAction = noPayloadHigherOrderActionCreatorFactory('explore/CLEAR_QUERIES').create();

/**
 * Highlight expressions in the log results
 */
export const highlightLogsExpressionAction = higherOrderActionCreatorFactory<HighlightLogsExpressionPayload>(
  'explore/HIGHLIGHT_LOGS_EXPRESSION'
).create();

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export const initializeExploreAction = higherOrderActionCreatorFactory<InitializeExplorePayload>(
  'explore/INITIALIZE_EXPLORE'
).create();

/**
 * Initialize the wrapper split state
 */
export const initializeExploreSplitAction = noPayloadActionCreatorFactory('explore/INITIALIZE_EXPLORE_SPLIT').create();

/**
 * Display an error that happened during the selection of a datasource
 */
export const loadDatasourceFailureAction = higherOrderActionCreatorFactory<LoadDatasourceFailurePayload>(
  'explore/LOAD_DATASOURCE_FAILURE'
).create();

/**
 * Display an error when no datasources have been configured
 */
export const loadDatasourceMissingAction = noPayloadHigherOrderActionCreatorFactory(
  'explore/LOAD_DATASOURCE_MISSING'
).create();

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export const loadDatasourcePendingAction = higherOrderActionCreatorFactory<LoadDatasourcePendingPayload>(
  'explore/LOAD_DATASOURCE_PENDING'
).create();

/**
 * Datasource loading was successfully completed. The instance is stored in the state as well in case we need to
 * run datasource-specific code. Existing queries are imported to the new datasource if an importer exists,
 * e.g., Prometheus -> Loki queries.
 */
export const loadDatasourceSuccessAction = higherOrderActionCreatorFactory<LoadDatasourceSuccessPayload>(
  'explore/LOAD_DATASOURCE_SUCCESS'
).create();

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export const modifyQueriesAction = higherOrderActionCreatorFactory<ModifyQueriesPayload>(
  'explore/MODIFY_QUERIES'
).create();

/**
 * Mark a query transaction as failed with an error extracted from the query response.
 * The transaction will be marked as `done`.
 */
export const queryTransactionFailureAction = higherOrderActionCreatorFactory<QueryTransactionFailurePayload>(
  'explore/QUERY_TRANSACTION_FAILURE'
).create();

/**
 * Start a query transaction for the given result type.
 * @param transaction Query options and `done` status.
 * @param resultType Associate the transaction with a result viewer, e.g., Graph
 * @param rowIndex Index is used to associate latency for this transaction with a query row
 */
export const queryTransactionStartAction = higherOrderActionCreatorFactory<QueryTransactionStartPayload>(
  'explore/QUERY_TRANSACTION_START'
).create();

/**
 * Complete a query transaction, mark the transaction as `done` and store query state in URL.
 * If the transaction was started by a scanner, it keeps on scanning for more results.
 * Side-effect: the query is stored in localStorage.
 * @param transactionId ID
 * @param result Response from `datasourceInstance.query()`
 * @param latency Duration between request and response
 * @param queries Queries from all query rows
 * @param datasourceId Origin datasource instance, used to discard results if current datasource is different
 */
export const queryTransactionSuccessAction = higherOrderActionCreatorFactory<QueryTransactionSuccessPayload>(
  'explore/QUERY_TRANSACTION_SUCCESS'
).create();

/**
 * Remove query row of the given index, as well as associated query results.
 */
export const removeQueryRowAction = higherOrderActionCreatorFactory<RemoveQueryRowPayload>(
  'explore/REMOVE_QUERY_ROW'
).create();
export const runQueriesEmptyAction = noPayloadHigherOrderActionCreatorFactory('explore/RUN_QUERIES_EMPTY').create();

/**
 * Start a scan for more results using the given scanner.
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export const scanStartAction = higherOrderActionCreatorFactory<ScanStartPayload>('explore/SCAN_START').create();
export const scanRangeAction = higherOrderActionCreatorFactory<ScanRangePayload>('explore/SCAN_RANGE').create();

/**
 * Stop any scanning for more results.
 */
export const scanStopAction = noPayloadHigherOrderActionCreatorFactory('explore/SCAN_STOP').create();

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export const setQueriesAction = higherOrderActionCreatorFactory<SetQueriesPayload>('explore/SET_QUERIES').create();

/**
 * Close the split view and save URL state.
 */
export const splitCloseAction = noPayloadActionCreatorFactory('explore/SPLIT_CLOSE').create();

/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export const splitOpenAction = actionCreatorFactory<SplitOpenPayload>('explore/SPLIT_OPEN').create();
export const stateSaveAction = noPayloadActionCreatorFactory('explore/STATE_SAVE').create();

/**
 * Update state of Explores UI elements (panels visiblity and deduplication  strategy)
 */
export const updateUIStateAction = higherOrderActionCreatorFactory<UpdateUIStatePayload>(
  'explore/UPDATE_UI_STATE'
).create();

/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export const toggleTableAction = noPayloadHigherOrderActionCreatorFactory('explore/TOGGLE_TABLE').create();

/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export const toggleGraphAction = noPayloadHigherOrderActionCreatorFactory('explore/TOGGLE_GRAPH').create();

/**
 * Expand/collapse the logs result viewer. When collapsed, log queries won't be run.
 */
export const toggleLogsAction = noPayloadHigherOrderActionCreatorFactory('explore/TOGGLE_LOGS').create();

/**
 * Updates datasource instance before datasouce loading has started
 */
export const updateDatasourceInstanceAction = higherOrderActionCreatorFactory<UpdateDatasourceInstancePayload>(
  'explore/UPDATE_DATASOURCE_INSTANCE'
).create();

export const toggleLogLevelAction = higherOrderActionCreatorFactory<ToggleLogLevelPayload>(
  'explore/TOGGLE_LOG_LEVEL'
).create();

/**
 * Resets state for explore.
 */
export const resetExploreAction = noPayloadActionCreatorFactory('explore/RESET_EXPLORE').create();
export const queriesImportedAction = higherOrderActionCreatorFactory<QueriesImportedPayload>(
  'explore/QueriesImported'
).create();

export type HigherOrderAction =
  | InitializeExploreSplitAction
  | SplitCloseAction
  | SplitOpenAction
  | ResetExploreAction
  | ActionOf<any>;

export type Action =
  | ActionOf<AddQueryRowPayload>
  | ActionOf<ChangeQueryPayload>
  | ActionOf<ChangeSizePayload>
  | ActionOf<ChangeTimePayload>
  | ActionOf<HighlightLogsExpressionPayload>
  | ActionOf<InitializeExplorePayload>
  | ActionOf<LoadDatasourceFailurePayload>
  | ActionOf<LoadDatasourcePendingPayload>
  | ActionOf<LoadDatasourceSuccessPayload>
  | ActionOf<ModifyQueriesPayload>
  | ActionOf<QueryTransactionFailurePayload>
  | ActionOf<QueryTransactionStartPayload>
  | ActionOf<QueryTransactionSuccessPayload>
  | ActionOf<RemoveQueryRowPayload>
  | ActionOf<ScanStartPayload>
  | ActionOf<ScanRangePayload>
  | ActionOf<SetQueriesPayload>
  | ActionOf<SplitOpenPayload>
  | ActionOf<UpdateDatasourceInstancePayload>
  | ActionOf<QueriesImportedPayload>
  | ActionOf<ToggleLogLevelPayload>;
