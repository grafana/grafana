// Types
import { Emitter } from 'app/core/core';
import { DataQuery, DataSourceSelectItem, DataSourceApi, QueryFixAction, PanelData } from '@grafana/ui';

import { LogLevel, TimeRange, LoadingState, AbsoluteTimeRange } from '@grafana/data';
import { ExploreId, ExploreItemState, HistoryItem, ExploreUIState, ExploreMode } from 'app/types/explore';
import { actionCreatorFactory, noPayloadActionCreatorFactory, ActionOf } from 'app/core/redux/actionCreatorFactory';

/**  Higher order actions
 *
 */
export enum ActionTypes {
  SplitOpen = 'explore/SPLIT_OPEN',
  ResetExplore = 'explore/RESET_EXPLORE',
}
export interface SplitOpenAction {
  type: ActionTypes.SplitOpen;
  payload: {
    itemState: ExploreItemState;
  };
}

export interface ResetExploreAction {
  type: ActionTypes.ResetExplore;
  payload: {};
}

/**  Lower order actions
 *
 */
export interface AddQueryRowPayload {
  exploreId: ExploreId;
  index: number;
  query: DataQuery;
}

export interface ChangeModePayload {
  exploreId: ExploreId;
  mode: ExploreMode;
}

export interface ChangeQueryPayload {
  exploreId: ExploreId;
  query: DataQuery;
  index: number;
  override: boolean;
}

export interface ChangeSizePayload {
  exploreId: ExploreId;
  width: number;
  height: number;
}

export interface ChangeRefreshIntervalPayload {
  exploreId: ExploreId;
  refreshInterval: string;
}

export interface ClearQueriesPayload {
  exploreId: ExploreId;
}

export interface HighlightLogsExpressionPayload {
  exploreId: ExploreId;
  expressions: string[];
}

export interface InitializeExplorePayload {
  exploreId: ExploreId;
  containerWidth: number;
  eventBridge: Emitter;
  queries: DataQuery[];
  range: TimeRange;
  mode: ExploreMode;
  ui: ExploreUIState;
  originPanelId: number;
}

export interface LoadDatasourceMissingPayload {
  exploreId: ExploreId;
}

export interface LoadDatasourcePendingPayload {
  exploreId: ExploreId;
  requestedDatasourceName: string;
}

export interface LoadDatasourceReadyPayload {
  exploreId: ExploreId;
  history: HistoryItem[];
}

export interface TestDatasourcePendingPayload {
  exploreId: ExploreId;
}

export interface TestDatasourceFailurePayload {
  exploreId: ExploreId;
  error: string;
}

export interface TestDatasourceSuccessPayload {
  exploreId: ExploreId;
}

export interface ModifyQueriesPayload {
  exploreId: ExploreId;
  modification: QueryFixAction;
  index: number;
  modifier: (query: DataQuery, modification: QueryFixAction) => DataQuery;
}

export interface QueryStartPayload {
  exploreId: ExploreId;
}

export interface QueryEndedPayload {
  exploreId: ExploreId;
  response: PanelData;
}

export interface HistoryUpdatedPayload {
  exploreId: ExploreId;
  history: HistoryItem[];
}

export interface RemoveQueryRowPayload {
  exploreId: ExploreId;
  index: number;
}

export interface ScanStartPayload {
  exploreId: ExploreId;
}

export interface ScanStopPayload {
  exploreId: ExploreId;
}

export interface SetQueriesPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
}

export interface SplitCloseActionPayload {
  itemId: ExploreId;
}

export interface SplitOpenPayload {
  itemState: ExploreItemState;
}

export interface ToggleTablePayload {
  exploreId: ExploreId;
}

export interface ToggleGraphPayload {
  exploreId: ExploreId;
}

export interface UpdateUIStatePayload extends Partial<ExploreUIState> {
  exploreId: ExploreId;
}

export interface UpdateDatasourceInstancePayload {
  exploreId: ExploreId;
  datasourceInstance: DataSourceApi;
}

export interface ToggleLogLevelPayload {
  exploreId: ExploreId;
  hiddenLogLevels: LogLevel[];
}

export interface QueriesImportedPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
}

export interface LoadExploreDataSourcesPayload {
  exploreId: ExploreId;
  exploreDatasources: DataSourceSelectItem[];
}

export interface SetUrlReplacedPayload {
  exploreId: ExploreId;
}

export interface ChangeRangePayload {
  exploreId: ExploreId;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
}

export interface ChangeLoadingStatePayload {
  exploreId: ExploreId;
  loadingState: LoadingState;
}

export interface SetPausedStatePayload {
  exploreId: ExploreId;
  isPaused: boolean;
}

/**
 * Adds a query row after the row with the given index.
 */
export const addQueryRowAction = actionCreatorFactory<AddQueryRowPayload>('explore/ADD_QUERY_ROW').create();

/**
 * Change the mode of Explore.
 */
export const changeModeAction = actionCreatorFactory<ChangeModePayload>('explore/CHANGE_MODE').create();

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export const changeQueryAction = actionCreatorFactory<ChangeQueryPayload>('explore/CHANGE_QUERY').create();

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export const changeSizeAction = actionCreatorFactory<ChangeSizePayload>('explore/CHANGE_SIZE').create();

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export const changeRefreshIntervalAction = actionCreatorFactory<ChangeRefreshIntervalPayload>(
  'explore/CHANGE_REFRESH_INTERVAL'
).create();

/**
 * Clear all queries and results.
 */
export const clearQueriesAction = actionCreatorFactory<ClearQueriesPayload>('explore/CLEAR_QUERIES').create();

/**
 * Highlight expressions in the log results
 */
export const highlightLogsExpressionAction = actionCreatorFactory<HighlightLogsExpressionPayload>(
  'explore/HIGHLIGHT_LOGS_EXPRESSION'
).create();

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export const initializeExploreAction = actionCreatorFactory<InitializeExplorePayload>(
  'explore/INITIALIZE_EXPLORE'
).create();

/**
 * Display an error when no datasources have been configured
 */
export const loadDatasourceMissingAction = actionCreatorFactory<LoadDatasourceMissingPayload>(
  'explore/LOAD_DATASOURCE_MISSING'
).create();

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export const loadDatasourcePendingAction = actionCreatorFactory<LoadDatasourcePendingPayload>(
  'explore/LOAD_DATASOURCE_PENDING'
).create();

/**
 * Datasource loading was completed.
 */
export const loadDatasourceReadyAction = actionCreatorFactory<LoadDatasourceReadyPayload>(
  'explore/LOAD_DATASOURCE_READY'
).create();

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export const modifyQueriesAction = actionCreatorFactory<ModifyQueriesPayload>('explore/MODIFY_QUERIES').create();

export const queryStartAction = actionCreatorFactory<QueryStartPayload>('explore/QUERY_START').create();

export const queryEndedAction = actionCreatorFactory<QueryEndedPayload>('explore/QUERY_ENDED').create();

export const queryStreamUpdatedAction = actionCreatorFactory<QueryEndedPayload>(
  'explore/QUERY_STREAM_UPDATED'
).create();

/**
 * Remove query row of the given index, as well as associated query results.
 */
export const removeQueryRowAction = actionCreatorFactory<RemoveQueryRowPayload>('explore/REMOVE_QUERY_ROW').create();

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export const scanStartAction = actionCreatorFactory<ScanStartPayload>('explore/SCAN_START').create();

/**
 * Stop any scanning for more results.
 */
export const scanStopAction = actionCreatorFactory<ScanStopPayload>('explore/SCAN_STOP').create();

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export const setQueriesAction = actionCreatorFactory<SetQueriesPayload>('explore/SET_QUERIES').create();

/**
 * Close the split view and save URL state.
 */
export const splitCloseAction = actionCreatorFactory<SplitCloseActionPayload>('explore/SPLIT_CLOSE').create();

/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export const splitOpenAction = actionCreatorFactory<SplitOpenPayload>('explore/SPLIT_OPEN').create();

/**
 * Update state of Explores UI elements (panels visiblity and deduplication  strategy)
 */
export const updateUIStateAction = actionCreatorFactory<UpdateUIStatePayload>('explore/UPDATE_UI_STATE').create();

/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export const toggleTableAction = actionCreatorFactory<ToggleTablePayload>('explore/TOGGLE_TABLE').create();

/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export const toggleGraphAction = actionCreatorFactory<ToggleGraphPayload>('explore/TOGGLE_GRAPH').create();

/**
 * Updates datasource instance before datasouce loading has started
 */
export const updateDatasourceInstanceAction = actionCreatorFactory<UpdateDatasourceInstancePayload>(
  'explore/UPDATE_DATASOURCE_INSTANCE'
).create();

export const toggleLogLevelAction = actionCreatorFactory<ToggleLogLevelPayload>('explore/TOGGLE_LOG_LEVEL').create();

/**
 * Resets state for explore.
 */
export const resetExploreAction = noPayloadActionCreatorFactory('explore/RESET_EXPLORE').create();
export const queriesImportedAction = actionCreatorFactory<QueriesImportedPayload>('explore/QueriesImported').create();
export const testDataSourcePendingAction = actionCreatorFactory<TestDatasourcePendingPayload>(
  'explore/TEST_DATASOURCE_PENDING'
).create();
export const testDataSourceSuccessAction = actionCreatorFactory<TestDatasourceSuccessPayload>(
  'explore/TEST_DATASOURCE_SUCCESS'
).create();
export const testDataSourceFailureAction = actionCreatorFactory<TestDatasourceFailurePayload>(
  'explore/TEST_DATASOURCE_FAILURE'
).create();
export const loadExploreDatasources = actionCreatorFactory<LoadExploreDataSourcesPayload>(
  'explore/LOAD_EXPLORE_DATASOURCES'
).create();

export const historyUpdatedAction = actionCreatorFactory<HistoryUpdatedPayload>('explore/HISTORY_UPDATED').create();

export const setUrlReplacedAction = actionCreatorFactory<SetUrlReplacedPayload>('explore/SET_URL_REPLACED').create();

export const changeRangeAction = actionCreatorFactory<ChangeRangePayload>('explore/CHANGE_RANGE').create();

export const changeLoadingStateAction = actionCreatorFactory<ChangeLoadingStatePayload>(
  'changeLoadingStateAction'
).create();

export const setPausedStateAction = actionCreatorFactory<SetPausedStatePayload>('explore/SET_PAUSED_STATE').create();

export type HigherOrderAction =
  | ActionOf<SplitCloseActionPayload>
  | SplitOpenAction
  | ResetExploreAction
  | ActionOf<any>;
