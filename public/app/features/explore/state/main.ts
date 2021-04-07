import { AnyAction } from 'redux';
import { DataSourceSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { DataQuery, ExploreUrlState, serializeStateToUrlParam, TimeRange, UrlQueryMap } from '@grafana/data';
import { GetExploreUrlArguments, stopQueryState } from 'app/core/utils/explore';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';
import { paneReducer } from './explorePane';
import { createAction } from '@reduxjs/toolkit';
import { getUrlStateFromPaneState, makeExplorePaneState } from './utils';
import { ThunkResult } from '../../../types';
import { TimeSrv } from '../../dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';

//
// Actions and Payloads
//

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

/**
 * Close the split view and save URL state.
 */
export interface SplitCloseActionPayload {
  itemId: ExploreId;
}
export const splitCloseAction = createAction<SplitCloseActionPayload>('explore/splitClose');

/**
 * Cleans up a pane state. Could seem like this should be in explorePane.ts actions but in case we area closing
 * left pane we need to move right state to the left.
 * Also this may seem redundant as we have splitClose actions which clears up state but that action is not called on
 * URL change.
 */
export interface CleanupPanePayload {
  exploreId: ExploreId;
}
export const cleanupPaneAction = createAction<CleanupPanePayload>('explore/cleanupPane');

//
// Action creators
//

/**
 * Save local redux state back to the URL. Should be called when there is some change that should affect the URL.
 * Not all of the redux state is reflected in URL though.
 */
export const stateSave = (options?: { replace?: boolean }): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { left, right } = getState().explore;
    const orgId = getState().user.orgId.toString();
    const urlStates: { [index: string]: string | null } = { orgId };

    urlStates.left = serializeStateToUrlParam(getUrlStateFromPaneState(left), true);

    if (right) {
      urlStates.right = serializeStateToUrlParam(getUrlStateFromPaneState(right), true);
    } else {
      urlStates.right = null;
    }

    lastSavedUrl.right = urlStates.right;
    lastSavedUrl.left = urlStates.left;

    locationService.partial({ ...urlStates }, options?.replace);
  };
};

// Store the url we saved last se we are not trying to update local state based on that.
export const lastSavedUrl: UrlQueryMap = {};

/**
 * Opens a new right split pane by navigating to appropriate URL. It either copies existing state of the left pane
 * or uses values from options arg. This does only navigation each pane is then responsible for initialization from
 * the URL.
 */
export function splitOpen<T extends DataQuery = any>(options?: {
  datasourceUid: string;
  query: T;
  // Don't use right now. It's used for Traces to Logs interaction but is hacky in how the range is actually handled.
  range?: TimeRange;
}): ThunkResult<void> {
  return async (dispatch, getState) => {
    const leftState: ExploreItemState = getState().explore[ExploreId.left];
    const leftUrlState = getUrlStateFromPaneState(leftState);
    let rightUrlState: ExploreUrlState = leftUrlState;

    if (options) {
      const datasourceName = getDataSourceSrv().getInstanceSettings(options.datasourceUid)?.name || '';
      rightUrlState = {
        datasource: datasourceName,
        queries: [options.query],
        range: options.range || leftState.range,
      };
    }

    const urlState = serializeStateToUrlParam(rightUrlState, true);
    locationService.partial({ right: urlState }, true);
  };
}

/**
 * Close the split view and save URL state. We need to update the state here because when closing we cannot just
 * update the URL and let the components handle it because if we swap panes from right to left it is not easily apparent
 * from the URL.
 */
export function splitClose(itemId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
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

    locationService.push(path!);
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

  if (cleanupPaneAction.match(action)) {
    const { exploreId } = action.payload as CleanupPanePayload;

    // We want to do this only when we remove single pane not when we are unmounting whole explore.
    // It needs to be checked like this because in component we don't get new path (which would tell us if we are
    // navigating out of explore) before the unmount.
    if (!state[exploreId]?.initialized) {
      return state;
    }

    if (exploreId === ExploreId.left) {
      return {
        ...state,
        [ExploreId.left]: state[ExploreId.right]!,
        [ExploreId.right]: undefined,
      };
    } else {
      return {
        ...state,
        [ExploreId.right]: undefined,
      };
    }
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
