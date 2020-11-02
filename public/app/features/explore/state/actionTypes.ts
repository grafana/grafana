// Types
import { createAction } from '@reduxjs/toolkit';

import { Emitter } from 'app/core/core';
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  HistoryItem,
  LoadingState,
  LogLevel,
  LogsDedupStrategy,
  TimeRange,
} from '@grafana/data';
import { ExploreId } from 'app/types/explore';

export interface ChangeSizePayload {
  exploreId: ExploreId;
  width: number;
  height: number;
}

export interface ChangeRefreshIntervalPayload {
  exploreId: ExploreId;
  refreshInterval: string;
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
  originPanelId?: number | null;
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

export interface HistoryUpdatedPayload {
  exploreId: ExploreId;
  history: HistoryItem[];
}

export interface ScanStartPayload {
  exploreId: ExploreId;
}

export interface ScanStopPayload {
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

export interface ChangeDedupStrategyPayload {
  exploreId: ExploreId;
  dedupStrategy: LogsDedupStrategy;
}

/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export const changeSizeAction = createAction<ChangeSizePayload>('explore/changeSize');

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export const changeRefreshIntervalAction = createAction<ChangeRefreshIntervalPayload>('explore/changeRefreshInterval');

/**
 * Change deduplication strategy for logs.
 */
export const changeDedupStrategyAction = createAction<ChangeDedupStrategyPayload>('explore/changeDedupStrategyAction');

/**
 * Highlight expressions in the log results
 */
export const highlightLogsExpressionAction = createAction<HighlightLogsExpressionPayload>(
  'explore/highlightLogsExpression'
);

/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 */
export const initializeExploreAction = createAction<InitializeExplorePayload>('explore/initializeExplore');

/**
 * Display an error when no datasources have been configured
 */
export const loadDatasourceMissingAction = createAction<LoadDatasourceMissingPayload>('explore/loadDatasourceMissing');

/**
 * Start the async process of loading a datasource to display a loading indicator
 */
export const loadDatasourcePendingAction = createAction<LoadDatasourcePendingPayload>('explore/loadDatasourcePending');

/**
 * Datasource loading was completed.
 */
export const loadDatasourceReadyAction = createAction<LoadDatasourceReadyPayload>('explore/loadDatasourceReady');

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export const scanStartAction = createAction<ScanStartPayload>('explore/scanStart');

/**
 * Stop any scanning for more results.
 */
export const scanStopAction = createAction<ScanStopPayload>('explore/scanStop');

/**
 * Updates datasource instance before datasouce loading has started
 */
export const updateDatasourceInstanceAction = createAction<UpdateDatasourceInstancePayload>(
  'explore/updateDatasourceInstance'
);

export const toggleLogLevelAction = createAction<ToggleLogLevelPayload>('explore/toggleLogLevel');

export const queriesImportedAction = createAction<QueriesImportedPayload>('explore/queriesImported');

export const historyUpdatedAction = createAction<HistoryUpdatedPayload>('explore/historyUpdated');

export const setUrlReplacedAction = createAction<SetUrlReplacedPayload>('explore/setUrlReplaced');

export const changeRangeAction = createAction<ChangeRangePayload>('explore/changeRange');

export const changeLoadingStateAction = createAction<ChangeLoadingStatePayload>('changeLoadingState');

export const setPausedStateAction = createAction<SetPausedStatePayload>('explore/setPausedState');
