// Libraries
import { map, throttleTime } from 'rxjs/operators';
import { identity } from 'rxjs';
import { ActionCreatorWithPayload, PayloadAction } from '@reduxjs/toolkit';
import { DataSourceSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import {
  AbsoluteTimeRange,
  DataQuery,
  DataSourceApi,
  dateTimeForTimeZone,
  isDateTime,
  LoadingState,
  LogsDedupStrategy,
  PanelData,
  QueryFixAction,
  RawTimeRange,
  TimeRange,
  ExploreMode,
} from '@grafana/data';
// Services & Utils
import store from 'app/core/store';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { Emitter } from 'app/core/core';
import {
  buildQueryTransaction,
  clearQueryKeys,
  ensureQueries,
  generateEmptyQuery,
  generateNewKeyAndAddRefIdIfMissing,
  GetExploreUrlArguments,
  getTimeRange,
  getTimeRangeFromUrl,
  hasNonEmptyQuery,
  lastUsedDatasourceKeyForOrgId,
  parseUrlState,
  serializeStateToUrlParam,
  stopQueryState,
  updateHistory,
} from 'app/core/utils/explore';
import {
  addToRichHistory,
  deleteAllFromRichHistory,
  updateStarredInRichHistory,
  updateCommentInRichHistory,
  deleteQueryInRichHistory,
  getQueryDisplayText,
  getRichHistory,
} from 'app/core/utils/richHistory';
// Types
import { ExploreItemState, ExploreUrlState, ThunkResult } from 'app/types';

import { ExploreId, ExploreUIState, QueryOptions } from 'app/types/explore';
import {
  addQueryRowAction,
  changeModeAction,
  changeQueryAction,
  changeRangeAction,
  changeRefreshIntervalAction,
  ChangeRefreshIntervalPayload,
  changeSizeAction,
  ChangeSizePayload,
  clearQueriesAction,
  historyUpdatedAction,
  richHistoryUpdatedAction,
  initializeExploreAction,
  loadDatasourceMissingAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  LoadDatasourceReadyPayload,
  modifyQueriesAction,
  queriesImportedAction,
  queryStoreSubscriptionAction,
  queryStreamUpdatedAction,
  scanStartAction,
  scanStopAction,
  setQueriesAction,
  setUrlReplacedAction,
  splitCloseAction,
  splitOpenAction,
  syncTimesAction,
  toggleGraphAction,
  ToggleGraphPayload,
  toggleTableAction,
  ToggleTablePayload,
  updateDatasourceInstanceAction,
  updateUIStateAction,
  changeLoadingStateAction,
  cancelQueriesAction,
} from './actionTypes';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';
import { updateLocation } from '../../../core/actions';
import { getTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { preProcessPanelData, runRequest } from '../../dashboard/state/runRequest';
import { PanelModel } from 'app/features/dashboard/state';
import { getExploreDatasources } from './selectors';

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
    const queries = getState().explore[exploreId].queries;
    const query = generateEmptyQuery(queries, index);

    dispatch(addQueryRowAction({ exploreId, index, query }));
  };
}

/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId: ExploreId, datasource: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    let newDataSourceInstance: DataSourceApi;

    if (!datasource) {
      newDataSourceInstance = await getDatasourceSrv().get();
    } else {
      newDataSourceInstance = await getDatasourceSrv().get(datasource);
    }

    const currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
    const queries = getState().explore[exploreId].queries;
    const orgId = getState().user.orgId;
    const datasourceVersion = newDataSourceInstance.getVersion && (await newDataSourceInstance.getVersion());

    // HACK: Switch to logs mode if coming from Prometheus to Loki
    const prometheusToLoki =
      currentDataSourceInstance?.meta?.name === 'Prometheus' && newDataSourceInstance?.meta?.name === 'Loki';

    dispatch(
      updateDatasourceInstanceAction({
        exploreId,
        datasourceInstance: newDataSourceInstance,
        version: datasourceVersion,
        mode: prometheusToLoki ? ExploreMode.Logs : undefined,
      })
    );

    await dispatch(importQueries(exploreId, queries, currentDataSourceInstance, newDataSourceInstance));

    if (getState().explore[exploreId].isLive) {
      dispatch(changeRefreshInterval(exploreId, RefreshPicker.offOption.value));
    }

    await dispatch(loadDatasource(exploreId, newDataSourceInstance, orgId));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Change the display mode in Explore.
 */
export function changeMode(exploreId: ExploreId, mode: ExploreMode): ThunkResult<void> {
  return dispatch => {
    dispatch(changeModeAction({ exploreId, mode }));
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
  override = false
): ThunkResult<void> {
  return (dispatch, getState) => {
    // Null query means reset
    if (query === null) {
      const queries = getState().explore[exploreId].queries;
      const { refId, key } = queries[index];
      query = generateNewKeyAndAddRefIdIfMissing({ refId, key }, queries, index);
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
): PayloadAction<ChangeSizePayload> {
  return changeSizeAction({ exploreId, height, width });
}

export const updateTimeRange = (options: {
  exploreId: ExploreId;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { syncedTimes } = getState().explore;
    if (syncedTimes) {
      dispatch(updateTime({ ...options, exploreId: ExploreId.left }));
      dispatch(runQueries(ExploreId.left));
      dispatch(updateTime({ ...options, exploreId: ExploreId.right }));
      dispatch(runQueries(ExploreId.right));
    } else {
      dispatch(updateTime({ ...options }));
      dispatch(runQueries(options.exploreId));
    }
  };
};
/**
 * Change the refresh interval of Explore. Called from the Refresh picker.
 */
export function changeRefreshInterval(
  exploreId: ExploreId,
  refreshInterval: string
): PayloadAction<ChangeRefreshIntervalPayload> {
  return changeRefreshIntervalAction({ exploreId, refreshInterval });
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
 * Cancel running queries
 */
export function cancelQueries(exploreId: ExploreId): ThunkResult<void> {
  return dispatch => {
    dispatch(scanStopAction({ exploreId }));
    dispatch(cancelQueriesAction({ exploreId }));
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
    const exploreDatasources = getExploreDatasources();

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
  range: TimeRange,
  mode: ExploreMode,
  containerWidth: number,
  eventBridge: Emitter,
  ui: ExploreUIState,
  originPanelId: number
): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(loadExploreDatasourcesAndSetDatasource(exploreId, datasourceName));
    dispatch(
      initializeExploreAction({
        exploreId,
        containerWidth,
        eventBridge,
        queries,
        range,
        mode,
        ui,
        originPanelId,
      })
    );
    dispatch(updateTime({ exploreId }));
    const richHistory = getRichHistory();
    dispatch(richHistoryUpdatedAction({ richHistory }));
  };
}

/**
 * Datasource loading was successfully completed.
 */
export const loadDatasourceReady = (
  exploreId: ExploreId,
  instance: DataSourceApi,
  orgId: number
): PayloadAction<LoadDatasourceReadyPayload> => {
  const historyKey = `grafana.explore.history.${instance.meta?.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource

  store.set(lastUsedDatasourceKeyForOrgId(orgId), instance.name);

  return loadDatasourceReadyAction({
    exploreId,
    history,
  });
};

/**
 * Import queries from previous datasource if possible eg Loki and Prometheus have similar query language so the
 * labels part can be reused to get similar data.
 * @param exploreId
 * @param queries
 * @param sourceDataSource
 * @param targetDataSource
 */
export const importQueries = (
  exploreId: ExploreId,
  queries: DataQuery[],
  sourceDataSource: DataSourceApi | undefined,
  targetDataSource: DataSourceApi
): ThunkResult<void> => {
  return async dispatch => {
    if (!sourceDataSource) {
      // explore not initialized
      dispatch(queriesImportedAction({ exploreId, queries }));
      return;
    }

    let importedQueries = queries;
    // Check if queries can be imported from previously selected datasource
    if (sourceDataSource.meta?.id === targetDataSource.meta?.id) {
      // Keep same queries if same type of datasource
      importedQueries = [...queries];
    } else if (targetDataSource.importQueries) {
      // Datasource-specific importers
      importedQueries = await targetDataSource.importQueries(queries, sourceDataSource.meta);
    } else {
      // Default is blank queries
      importedQueries = ensureQueries();
    }

    const nextQueries = ensureQueries(importedQueries);

    dispatch(queriesImportedAction({ exploreId, queries: nextQueries }));
  };
};

/**
 * Main action to asynchronously load a datasource. Dispatches lots of smaller actions for feedback.
 */
export const loadDatasource = (exploreId: ExploreId, instance: DataSourceApi, orgId: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const datasourceName = instance.name;

    // Keep ID to track selection
    dispatch(loadDatasourcePendingAction({ exploreId, requestedDatasourceName: datasourceName }));

    if (instance.init) {
      try {
        instance.init();
      } catch (err) {
        console.log(err);
      }
    }

    if (datasourceName !== getState().explore[exploreId].requestedDatasourceName) {
      // User already changed datasource, discard results
      return;
    }

    dispatch(loadDatasourceReady(exploreId, instance, orgId));
  };
};

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
  modifier: any,
  index?: number
): ThunkResult<void> {
  return dispatch => {
    dispatch(modifyQueriesAction({ exploreId, modification, index, modifier }));
    if (!modification.preventSubmit) {
      dispatch(runQueries(exploreId));
    }
  };
}

/**
 * Main action to run queries and dispatches sub-actions based on which result viewers are active
 */
export const runQueries = (exploreId: ExploreId): ThunkResult<void> => {
  return (dispatch, getState) => {
    dispatch(updateTime({ exploreId }));

    const richHistory = getState().explore.richHistory;
    const exploreItemState = getState().explore[exploreId];
    const {
      datasourceInstance,
      queries,
      containerWidth,
      isLive: live,
      range,
      scanning,
      queryResponse,
      querySubscription,
      history,
      mode,
      showingGraph,
      showingTable,
    } = exploreItemState;

    if (!hasNonEmptyQuery(queries)) {
      dispatch(clearQueriesAction({ exploreId }));
      dispatch(stateSave()); // Remember to save to state and update location
      return;
    }

    // Some datasource's query builders allow per-query interval limits,
    // but we're using the datasource interval limit for now
    const minInterval = datasourceInstance.interval;

    stopQueryState(querySubscription);

    const datasourceId = datasourceInstance.meta.id;

    const queryOptions: QueryOptions = {
      minInterval,
      // maxDataPoints is used in:
      // Loki - used for logs streaming for buffer size, with undefined it falls back to datasource config if it supports that.
      // Elastic - limits the number of datapoints for the counts query and for logs it has hardcoded limit.
      // Influx - used to correctly display logs in graph
      maxDataPoints: mode === ExploreMode.Logs && datasourceId === 'loki' ? undefined : containerWidth,
      liveStreaming: live,
      showingGraph,
      showingTable,
      mode,
    };

    const datasourceName = exploreItemState.requestedDatasourceName;

    const transaction = buildQueryTransaction(queries, queryOptions, range, scanning);

    let firstResponse = true;
    dispatch(changeLoadingStateAction({ exploreId, loadingState: LoadingState.Loading }));

    const newQuerySub = runRequest(datasourceInstance, transaction.request)
      .pipe(
        // Simple throttle for live tailing, in case of > 1000 rows per interval we spend about 200ms on processing and
        // rendering. In case this is optimized this can be tweaked, but also it should be only as fast as user
        // actually can see what is happening.
        live ? throttleTime(500) : identity,
        map((data: PanelData) => preProcessPanelData(data, queryResponse))
      )
      .subscribe((data: PanelData) => {
        if (!data.error && firstResponse) {
          // Side-effect: Saving history in localstorage
          const nextHistory = updateHistory(history, datasourceId, queries);
          const arrayOfStringifiedQueries = queries.map(query =>
            datasourceInstance?.getQueryDisplayText
              ? datasourceInstance.getQueryDisplayText(query)
              : getQueryDisplayText(query)
          );

          const nextRichHistory = addToRichHistory(
            richHistory || [],
            datasourceId,
            datasourceName,
            arrayOfStringifiedQueries,
            false,
            '',
            ''
          );
          dispatch(historyUpdatedAction({ exploreId, history: nextHistory }));
          dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));

          // We save queries to the URL here so that only successfully run queries change the URL.
          dispatch(stateSave());
        }

        firstResponse = false;

        dispatch(queryStreamUpdatedAction({ exploreId, response: data }));

        // Keep scanning for results if this was the last scanning transaction
        if (getState().explore[exploreId].scanning) {
          if (data.state === LoadingState.Done && data.series.length === 0) {
            const range = getShiftedTimeRange(-1, getState().explore[exploreId].range);
            dispatch(updateTime({ exploreId, absoluteRange: range }));
            dispatch(runQueries(exploreId));
          } else {
            // We can stop scanning if we have a result
            dispatch(scanStopAction({ exploreId }));
          }
        }
      });

    dispatch(queryStoreSubscriptionAction({ exploreId, querySubscription: newQuerySub }));
  };
};

export const updateRichHistory = (ts: number, property: string, updatedProperty?: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    // Side-effect: Saving rich history in localstorage
    let nextRichHistory;
    if (property === 'starred') {
      nextRichHistory = updateStarredInRichHistory(getState().explore.richHistory, ts);
    }
    if (property === 'comment') {
      nextRichHistory = updateCommentInRichHistory(getState().explore.richHistory, ts, updatedProperty);
    }
    if (property === 'delete') {
      nextRichHistory = deleteQueryInRichHistory(getState().explore.richHistory, ts);
    }
    dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
  };
};

export const deleteRichHistory = (): ThunkResult<void> => {
  return dispatch => {
    deleteAllFromRichHistory();
    dispatch(richHistoryUpdatedAction({ richHistory: [] }));
  };
};

const toRawTimeRange = (range: TimeRange): RawTimeRange => {
  let from = range.raw.from;
  if (isDateTime(from)) {
    from = from.valueOf().toString(10);
  }

  let to = range.raw.to;
  if (isDateTime(to)) {
    to = to.valueOf().toString(10);
  }

  return {
    from,
    to,
  };
};

/**
 * Save local redux state back to the URL. Should be called when there is some change that should affect the URL.
 * Not all of the redux state is reflected in URL though.
 */
export const stateSave = (): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { left, right, split } = getState().explore;
    const orgId = getState().user.orgId.toString();
    const replace = left && left.urlReplaced === false;
    const urlStates: { [index: string]: string } = { orgId };
    const leftUrlState: ExploreUrlState = {
      datasource: left.datasourceInstance.name,
      queries: left.queries.map(clearQueryKeys),
      range: toRawTimeRange(left.range),
      mode: left.mode,
      ui: {
        showingGraph: left.showingGraph,
        showingLogs: true,
        showingTable: left.showingTable,
        dedupStrategy: left.dedupStrategy,
      },
    };
    urlStates.left = serializeStateToUrlParam(leftUrlState, true);
    if (split) {
      const rightUrlState: ExploreUrlState = {
        datasource: right.datasourceInstance.name,
        queries: right.queries.map(clearQueryKeys),
        range: toRawTimeRange(right.range),
        mode: right.mode,
        ui: {
          showingGraph: right.showingGraph,
          showingLogs: true,
          showingTable: right.showingTable,
          dedupStrategy: right.dedupStrategy,
        },
      };

      urlStates.right = serializeStateToUrlParam(rightUrlState, true);
    }

    dispatch(updateLocation({ query: urlStates, replace }));
    if (replace) {
      dispatch(setUrlReplacedAction({ exploreId: ExploreId.left }));
    }
  };
};

export const updateTime = (config: {
  exploreId: ExploreId;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { exploreId, absoluteRange: absRange, rawRange: actionRange } = config;
    const itemState = getState().explore[exploreId];
    const timeZone = getTimeZone(getState().user);
    const { range: rangeInState } = itemState;
    let rawRange: RawTimeRange = rangeInState.raw;

    if (absRange) {
      rawRange = {
        from: dateTimeForTimeZone(timeZone, absRange.from),
        to: dateTimeForTimeZone(timeZone, absRange.to),
      };
    }

    if (actionRange) {
      rawRange = actionRange;
    }

    const range = getTimeRange(timeZone, rawRange);
    const absoluteRange: AbsoluteTimeRange = { from: range.from.valueOf(), to: range.to.valueOf() };

    getTimeSrv().init({
      time: range.raw,
      refresh: false,
      getTimezone: () => timeZone,
      timeRangeUpdated: (): any => undefined,
    });

    dispatch(changeRangeAction({ exploreId, range, absoluteRange }));
  };
};

/**
 * Start a scan for more results using the given scanner.
 * @param exploreId Explore area
 * @param scanner Function that a) returns a new time range and b) triggers a query run for the new range
 */
export function scanStart(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    // Register the scanner
    dispatch(scanStartAction({ exploreId }));
    // Scanning must trigger query run, and return the new range
    const range = getShiftedTimeRange(-1, getState().explore[exploreId].range);
    // Set the new range to be displayed
    dispatch(updateTime({ exploreId, absoluteRange: range }));
    dispatch(runQueries(exploreId));
  };
}

/**
 * Reset queries to the given queries. Any modifications will be discarded.
 * Use this action for clicks on query examples. Triggers a query run.
 */
export function setQueries(exploreId: ExploreId, rawQueries: DataQuery[]): ThunkResult<void> {
  return (dispatch, getState) => {
    // Inject react keys into query objects
    const queries = getState().explore[exploreId].queries;
    const nextQueries = rawQueries.map((query, index) => generateNewKeyAndAddRefIdIfMissing(query, queries, index));
    dispatch(setQueriesAction({ exploreId, queries: nextQueries }));
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
export function splitOpen(dataSourceName?: string, query?: string): ThunkResult<void> {
  return async (dispatch, getState) => {
    // Clone left state to become the right state
    const leftState: ExploreItemState = getState().explore[ExploreId.left];
    const rightState: ExploreItemState = {
      ...leftState,
    };
    const queryState = getState().location.query[ExploreId.left] as string;
    const urlState = parseUrlState(queryState);
    rightState.queries = leftState.queries.slice();
    rightState.urlState = urlState;
    dispatch(splitOpenAction({ itemState: rightState }));

    if (dataSourceName && query) {
      // This is hardcoded for Jaeger right now
      const queries = [
        {
          query,
          refId: 'A',
        } as DataQuery,
      ];
      await dispatch(changeDatasource(ExploreId.right, dataSourceName));
      await dispatch(setQueriesAction({ exploreId: ExploreId.right, queries }));
    }

    dispatch(stateSave());
  };
}

/**
 * Syncs time interval, if they are not synced on both panels in a split mode.
 * Unsyncs time interval, if they are synced on both panels in a split mode.
 */
export function syncTimes(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    if (exploreId === ExploreId.left) {
      const leftState = getState().explore.left;
      dispatch(updateTimeRange({ exploreId: ExploreId.right, rawRange: leftState.range.raw }));
    } else {
      const rightState = getState().explore.right;
      dispatch(updateTimeRange({ exploreId: ExploreId.left, rawRange: rightState.range.raw }));
    }
    const isTimeSynced = getState().explore.syncedTimes;
    dispatch(syncTimesAction({ syncedTimes: !isTimeSynced }));
    dispatch(stateSave());
  };
}

/**
 * Creates action to collapse graph/logs/table panel. When panel is collapsed,
 * queries won't be run
 */
const togglePanelActionCreator = (
  actionCreator: ActionCreatorWithPayload<ToggleGraphPayload> | ActionCreatorWithPayload<ToggleTablePayload>
) => (exploreId: ExploreId, isPanelVisible: boolean): ThunkResult<void> => {
  return dispatch => {
    let uiFragmentStateUpdate: Partial<ExploreUIState>;
    const shouldRunQueries = !isPanelVisible;

    switch (actionCreator.type) {
      case toggleGraphAction.type:
        uiFragmentStateUpdate = { showingGraph: !isPanelVisible };
        break;
      case toggleTableAction.type:
        uiFragmentStateUpdate = { showingTable: !isPanelVisible };
        break;
    }

    dispatch(actionCreator({ exploreId }));
    // The switch further up is exhaustive so uiFragmentStateUpdate should definitely be initialized
    dispatch(updateExploreUIState(exploreId, uiFragmentStateUpdate!));

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

/**
 * Reacts to changes in URL state that we need to sync back to our redux state. Checks the internal update variable
 * to see which parts change and need to be synced.
 * @param exploreId
 */
export function refreshExplore(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    const itemState = getState().explore[exploreId];
    if (!itemState.initialized) {
      return;
    }

    const { urlState, update, containerWidth, eventBridge } = itemState;
    const { datasource, queries, range: urlRange, mode, ui, originPanelId } = urlState;
    const refreshQueries: DataQuery[] = [];
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      refreshQueries.push(generateNewKeyAndAddRefIdIfMissing(query, refreshQueries, index));
    }
    const timeZone = getTimeZone(getState().user);
    const range = getTimeRangeFromUrl(urlRange, timeZone);

    // need to refresh datasource
    if (update.datasource) {
      const initialQueries = ensureQueries(queries);
      dispatch(
        initializeExplore(
          exploreId,
          datasource,
          initialQueries,
          range,
          mode,
          containerWidth,
          eventBridge,
          ui,
          originPanelId
        )
      );
      return;
    }

    if (update.range) {
      dispatch(updateTime({ exploreId, rawRange: range.raw }));
    }

    // need to refresh ui state
    if (update.ui) {
      dispatch(updateUIStateAction({ ...ui, exploreId }));
    }

    // need to refresh queries
    if (update.queries) {
      dispatch(setQueriesAction({ exploreId, queries: refreshQueries }));
    }

    // need to refresh mode
    if (update.mode) {
      dispatch(changeModeAction({ exploreId, mode }));
    }

    // always run queries when refresh is needed
    if (update.queries || update.ui || update.range) {
      dispatch(runQueries(exploreId));
    }
  };
}

export interface NavigateToExploreDependencies {
  getDataSourceSrv: () => DataSourceSrv;
  getTimeSrv: () => TimeSrv;
  getExploreUrl: (args: GetExploreUrlArguments) => Promise<string>;
  openInNewWindow?: (url: string) => void;
}

export const navigateToExplore = (
  panel: PanelModel,
  dependencies: NavigateToExploreDependencies
): ThunkResult<void> => {
  return async dispatch => {
    const { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow } = dependencies;
    const datasourceSrv = getDataSourceSrv();
    const datasource = await datasourceSrv.get(panel.datasource);
    const path = await getExploreUrl({
      panel,
      panelTargets: panel.targets,
      panelDatasource: datasource,
      datasourceSrv,
      timeSrv: getTimeSrv(),
    });

    if (openInNewWindow) {
      openInNewWindow(path);
      return;
    }

    const query = {}; // strips any angular query param
    dispatch(updateLocation({ path, query }));
  };
};
