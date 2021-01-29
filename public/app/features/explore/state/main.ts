import { AnyAction } from 'redux';
import { DataSourceSrv } from '@grafana/runtime';
import { serializeStateToUrlParam } from '@grafana/data';

import { stopQueryState, GetExploreUrlArguments, clearQueryKeys } from 'app/core/utils/explore';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';
import { updateLocation } from '../../../core/actions';
import { paneReducer } from './explorePane';
import { createAction } from '@reduxjs/toolkit';
import { makeExplorePaneState } from './utils';
import { DataQuery, ExploreUrlState, TimeRange, UrlQueryMap } from '@grafana/data';
import { ThunkResult } from '../../../types';
import { TimeSrv } from '../../dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { toRawTimeRange } from '../utils/time';

//
// Actions and Payloads
//

/**
 * Close the split view and save URL state.
 */
export interface SplitCloseActionPayload {
  itemId: ExploreId;
}
export const splitCloseAction = createAction<SplitCloseActionPayload>('explore/splitClose');

/**
 * Open the split view and copy the left state to be the right state.
 * The right state is automatically initialized.
 * The copy keeps all query modifications but wipes the query results.
 */
export interface SplitOpenPayload {
  itemState: ExploreItemState;
}
export const splitOpenAction = createAction<SplitOpenPayload>('explore/splitOpen');

export interface SyncTimesPayload {
  syncedTimes: boolean;
}
export const syncTimesAction = createAction<SyncTimesPayload>('explore/syncTimes');

export const richHistoryUpdatedAction = createAction<any>('explore/richHistoryUpdated');

/**
 * Resets state for explore.
 */
export interface ResetExplorePayload {
  force?: boolean;
}
export const resetExploreAction = createAction<ResetExplorePayload>('explore/resetExplore');

//
// Action creators
//

/**
 * Save local redux state back to the URL. Should be called when there is some change that should affect the URL.
 * Not all of the redux state is reflected in URL though.
 */
export const stateSave = (): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { left, right } = getState().explore;
    const orgId = getState().user.orgId.toString();
    const urlStates: { [index: string]: string } = { orgId };
    urlStates.left = serializeStateToUrlParam(getUrlStateFromPaneState(left), true);
    if (right) {
      urlStates.right = serializeStateToUrlParam(getUrlStateFromPaneState(right), true);
    }

    lastSavedUrl.right = urlStates.right;
    lastSavedUrl.left = urlStates.left;
    // dispatch(updateLocation({ query: urlStates, partial: split && !right.initialized }));
    dispatch(updateLocation({ query: urlStates }));
  };
};

// Store the url we saved last se we are not trying to update local state based on that.
export const lastSavedUrl: UrlQueryMap = {};

/**
 * Open the split view and the right state is automatically initialized.
 * If options are specified it initializes that pane with the datasource and query from options.
 * Otherwise it copies the left state to be the right state. The copy keeps all query modifications but wipes the query
 * results.
 */
export function splitOpen<T extends DataQuery = any>(options?: {
  datasourceUid: string;
  query: T;
  // Don't use right now. It's used for Traces to Logs interaction but is hacky in how the range is actually handled.
  range?: TimeRange;
}): ThunkResult<void> {
  return async (dispatch, getState) => {
    // Clone left state to become the right state
    const leftState: ExploreItemState = getState().explore[ExploreId.left];
    const rightState: ExploreItemState = {
      ...leftState,
      initialized: false,
    };

    if (options) {
      rightState.graphResult = null;
      rightState.logsResult = null;
      rightState.tableResult = null;
      rightState.queryKeys = [];
      rightState.showLogs = false;
      rightState.showMetrics = false;
      rightState.showNodeGraph = false;
      rightState.showTrace = false;
      rightState.showTable = false;
      if (options.range) {
        // This is super hacky. In traces to logs we want to create a link but also internally open split window.
        // We use the same range object but the raw part is treated differently because it's parsed differently during
        // init depending on whether we open split or new window.
        rightState.range = {
          ...options.range,
          raw: {
            from: options.range.from.utc().toISOString(),
            to: options.range.to.utc().toISOString(),
          },
        };
      }

      rightState.queries = [
        {
          ...options.query,
          refId: 'A',
        } as DataQuery,
      ];

      dispatch(splitOpenAction({ itemState: rightState }));
    } else {
      rightState.queries = leftState.queries.slice();
      dispatch(splitOpenAction({ itemState: rightState }));
    }

    dispatch(stateSave());
  };
}

/**
 * Close the split view and save URL state.
 */
export function splitClose(itemId: ExploreId): ThunkResult<void> {
  return (dispatch) => {
    dispatch(splitCloseAction({ itemId }));
    dispatch(stateSave());
  };
}

export interface NavigateToExploreDependencies {
  getDataSourceSrv: () => DataSourceSrv;
  getTimeSrv: () => TimeSrv;
  getExploreUrl: (args: GetExploreUrlArguments) => Promise<string | undefined>;
  openInNewWindow?: (url: string) => void;
}

export const navigateToExplore = (
  panel: PanelModel,
  dependencies: NavigateToExploreDependencies
): ThunkResult<void> => {
  return async (dispatch) => {
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

    if (openInNewWindow && path) {
      openInNewWindow(path);
      return;
    }

    const query = {}; // strips any angular query param
    dispatch(updateLocation({ path, query }));
  };
};

/**
 * Global Explore state that handles multiple Explore areas and the split state
 */
const initialExploreItemState = makeExplorePaneState();
export const initialExploreState: ExploreState = {
  syncedTimes: false,
  left: initialExploreItemState,
  right: undefined,
  richHistory: [],
};

/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action: AnyAction): ExploreState => {
  if (splitCloseAction.match(action)) {
    const { itemId } = action.payload as SplitCloseActionPayload;
    const targetSplit = {
      left: itemId === ExploreId.left ? state.right! : state.left,
      right: undefined,
    };
    return {
      ...state,
      ...targetSplit,
    };
  }

  if (splitOpenAction.match(action)) {
    return { ...state, right: { ...action.payload.itemState } };
  }

  if (syncTimesAction.match(action)) {
    return { ...state, syncedTimes: action.payload.syncedTimes };
  }

  if (richHistoryUpdatedAction.match(action)) {
    return {
      ...state,
      richHistory: action.payload.richHistory,
    };
  }

  if (resetExploreAction.match(action)) {
    const payload: ResetExplorePayload = action.payload;
    const leftState = state[ExploreId.left];
    const rightState = state[ExploreId.right];
    stopQueryState(leftState.querySubscription);
    if (rightState) {
      stopQueryState(rightState.querySubscription);
    }

    if (payload.force || !Number.isInteger(state.left.originPanelId)) {
      return initialExploreState;
    }

    return {
      ...initialExploreState,
      left: {
        ...initialExploreItemState,
        queries: state.left.queries,
        originPanelId: state.left.originPanelId,
      },
    };
  }

  if (action.payload) {
    const { exploreId } = action.payload;
    if (exploreId !== undefined) {
      // @ts-ignore
      const explorePaneState = state[exploreId];
      return { ...state, [exploreId]: paneReducer(explorePaneState, action as any) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // It can happen that if we are in a split and initial load also runs queries we can be here before the second pane
    // is initialized so datasourceInstance will be still undefined.
    // TODO: this probably isn't good case we are saving an url based on this we should not save empty datasource.
    datasource: pane.datasourceInstance?.name || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toRawTimeRange(pane.range),
  };
}
