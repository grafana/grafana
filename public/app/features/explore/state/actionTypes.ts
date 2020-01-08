// Types
import { Unsubscribable } from 'rxjs';
import { createAction } from '@reduxjs/toolkit';

import { Emitter } from 'app/core/core';
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  HistoryItem,
  LoadingState,
  LogLevel,
  PanelData,
  QueryFixAction,
  TimeRange,
} from '@grafana/data';
import { ExploreId, ExploreItemState, ExploreMode, ExploreUIState } from 'app/types/explore';

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

export interface ClearOriginPayload {
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

export interface ModifyQueriesPayload {
  exploreId: ExploreId;
  modification: QueryFixAction;
  index?: number;
  modifier: (query: DataQuery, modification: QueryFixAction) => DataQuery;
}

export interface QueryEndedPayload {
  exploreId: ExploreId;
  response: PanelData;
}

export interface QueryStoreSubscriptionPayload {
  exploreId: ExploreId;
  querySubscription: Unsubscribable;
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

export interface SyncTimesPayload {
  syncedTimes: boolean;
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
  version?: string;
  mode?: ExploreMode;
}

export interface ToggleLogLevelPayload {
  exploreId: ExploreId;
  hiddenLogLevels: LogLevel[];
}

export interface QueriesImportedPayload {
  exploreId: ExploreId;
  queries: DataQuery[];
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

export interface ResetExplorePayload {
  force?: boolean;
}

/**
 * Adds a query row after the row with the given index.
 */
export const addQueryRowAction = createAction<AddQueryRowPayload>('explore/ADD_QUERY_ROW');

/**
 * Change the mode of Explore.
 */
export const changeModeAction = createAction<ChangeModePayload>('explore/CHANGE_MODE');

/**
 * Query change handler for the query row with the given index.
 * If `override` is reset the query modifications and run the queries. Use this to set queries via a link.
 */
export const changeQueryAction = createAction<ChangeQueryPayload>('explore/CHANGE_QUERY');

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export const changeSizeAction = createAction<ChangeSizePayload>('explore/CHANGE_SIZE');

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export const changeRefreshIntervalAction = createAction<ChangeRefreshIntervalPayload>(
  'explore/CHANGE_REFRESH_INTERVAL'
);

/**
 * Clear all queries and results.
 */
export const clearQueriesAction = createAction<ClearQueriesPayload>('explore/CLEAR_QUERIES');

/**
 * Clear origin panel id.
 */
export const clearOriginAction = createAction<ClearOriginPayload>('explore/CLEAR_ORIGIN');

/**
 * Highlight expressions in the log results
 */
export const highlightLogsExpressionAction = createAction<HighlightLogsExpressionPayload>(
  'explore/HIGHLIGHT_LOGS_EXPRESSION'
);

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export const initializeExploreAction = createAction<InitializeExplorePayload>('explore/INITIALIZE_EXPLORE');

/**
 * Display an error when no datasources have been configured
 */
export const loadDatasourceMissingAction = createAction<LoadDatasourceMissingPayload>(
  'explore/LOAD_DATASOURCE_MISSING'
);

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export const loadDatasourcePendingAction = createAction<LoadDatasourcePendingPayload>(
  'explore/LOAD_DATASOURCE_PENDING'
);

/**
 * Datasource loading was completed.
 */
export const loadDatasourceReadyAction = createAction<LoadDatasourceReadyPayload>('explore/LOAD_DATASOURCE_READY');

/**
 * Action to modify a query given a datasource-specific modifier action.
 * @param exploreId Explore area
 * @param modification Action object with a type, e.g., ADD_FILTER
 * @param index Optional query row index. If omitted, the modification is applied to all query rows.
 * @param modifier Function that executes the modification, typically `datasourceInstance.modifyQueries`.
 */
export const modifyQueriesAction = createAction<ModifyQueriesPayload>('explore/MODIFY_QUERIES');

export const queryStreamUpdatedAction = createAction<QueryEndedPayload>('explore/QUERY_STREAM_UPDATED');

export const queryStoreSubscriptionAction = createAction<QueryStoreSubscriptionPayload>(
  'explore/QUERY_STORE_SUBSCRIPTION'
);

/**
 * Remove query row of the given index, as well as associated query results.
 */
export const removeQueryRowAction = createAction<RemoveQueryRowPayload>('explore/REMOVE_QUERY_ROW');

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export const scanStartAction = createAction<ScanStartPayload>('explore/SCAN_START');

/**
 * Stop any scanning for more results.
 */
export const scanStopAction = createAction<ScanStopPayload>('explore/SCAN_STOP');

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export const setQueriesAction = createAction<SetQueriesPayload>('explore/SET_QUERIES');

/**
 * Close the split view and save URL state.
 */
export const splitCloseAction = createAction<SplitCloseActionPayload>('explore/SPLIT_CLOSE');

/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export const splitOpenAction = createAction<SplitOpenPayload>('explore/SPLIT_OPEN');

export const syncTimesAction = createAction<SyncTimesPayload>('explore/SYNC_TIMES');
/**
 * Update state of Explores UI elements (panels visiblity and deduplication  strategy)
 */
export const updateUIStateAction = createAction<UpdateUIStatePayload>('explore/UPDATE_UI_STATE');

/**
 * Expand/collapse the table result viewer. When collapsed, table queries won't be run.
 */
export const toggleTableAction = createAction<ToggleTablePayload>('explore/TOGGLE_TABLE');

/**
 * Expand/collapse the graph result viewer. When collapsed, graph queries won't be run.
 */
export const toggleGraphAction = createAction<ToggleGraphPayload>('explore/TOGGLE_GRAPH');

/**
 * Updates datasource instance before datasouce loading has started
 */
export const updateDatasourceInstanceAction = createAction<UpdateDatasourceInstancePayload>(
  'explore/UPDATE_DATASOURCE_INSTANCE'
);

export const toggleLogLevelAction = createAction<ToggleLogLevelPayload>('explore/TOGGLE_LOG_LEVEL');

/**
 * Resets state for explore.
 */
export const resetExploreAction = createAction<ResetExplorePayload>('explore/RESET_EXPLORE');
export const queriesImportedAction = createAction<QueriesImportedPayload>('explore/QueriesImported');

export const historyUpdatedAction = createAction<HistoryUpdatedPayload>('explore/HISTORY_UPDATED');

export const setUrlReplacedAction = createAction<SetUrlReplacedPayload>('explore/SET_URL_REPLACED');

export const changeRangeAction = createAction<ChangeRangePayload>('explore/CHANGE_RANGE');

export const changeLoadingStateAction = createAction<ChangeLoadingStatePayload>('changeLoadingStateAction');

export const setPausedStateAction = createAction<SetPausedStatePayload>('explore/SET_PAUSED_STATE');
