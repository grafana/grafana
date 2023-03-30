import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { ExploreUrlState, serializeStateToUrlParam, SplitOpenOptions, UrlQueryMap } from '@grafana/data';
import { DataSourceSrv, locationService } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { GetExploreUrlArguments, stopQueryState } from 'app/core/utils/explore';
import { PanelModel } from 'app/features/dashboard/state';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';

import { RichHistoryResults } from '../../../core/history/RichHistoryStorage';
import { RichHistorySearchFilters, RichHistorySettings } from '../../../core/utils/richHistoryTypes';
import { ThunkResult } from '../../../types';
import { CorrelationData } from '../../correlations/useCorrelations';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

import { paneReducer } from './explorePane';
import { getUrlStateFromPaneState, makeExplorePaneState } from './utils';

//
// Actions and Payloads
//

export interface SyncTimesPayload {
  syncedTimes: boolean;
}
export const syncTimesAction = createAction<SyncTimesPayload>('explore/syncTimes');

export const richHistoryUpdatedAction = createAction<{ richHistoryResults: RichHistoryResults; exploreId: ExploreId }>(
  'explore/richHistoryUpdated'
);
export const richHistoryStorageFullAction = createAction('explore/richHistoryStorageFullAction');
export const richHistoryLimitExceededAction = createAction('explore/richHistoryLimitExceededAction');
export const richHistoryMigrationFailedAction = createAction('explore/richHistoryMigrationFailedAction');

export const richHistorySettingsUpdatedAction = createAction<RichHistorySettings>('explore/richHistorySettingsUpdated');
export const richHistorySearchFiltersUpdatedAction = createAction<{
  exploreId: ExploreId;
  filters?: RichHistorySearchFilters;
}>('explore/richHistorySearchFiltersUpdatedAction');

export const saveCorrelationsAction = createAction<CorrelationData[]>('explore/saveCorrelationsAction');

export const splitSizeUpdateAction = createAction<{
  largerExploreId?: ExploreId;
}>('explore/splitSizeUpdateAction');

export const maximizePaneAction = createAction<{
  exploreId?: ExploreId;
}>('explore/maximizePaneAction');

export const evenPaneResizeAction = createAction('explore/evenPaneResizeAction');

/**
 * Resets state for explore.
 */
export const resetExploreAction = createAction('explore/resetExplore');

/**
 * Close the split view and save URL state.
 */
export interface SplitCloseActionPayload {
  itemId: ExploreId;
}
export const splitCloseAction = createAction<SplitCloseActionPayload>('explore/splitClose');

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

    urlStates.left = serializeStateToUrlParam(getUrlStateFromPaneState(left));

    if (right) {
      urlStates.right = serializeStateToUrlParam(getUrlStateFromPaneState(right));
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
export const splitOpen = <T extends DataQuery = DataQuery>(options?: SplitOpenOptions<T>): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const leftState: ExploreItemState = getState().explore[ExploreId.left];
    const leftUrlState = getUrlStateFromPaneState(leftState);
    let rightUrlState: ExploreUrlState = leftUrlState;

    if (options) {
      const { query, queries } = options;

      rightUrlState = {
        datasource: options.datasourceUid,
        queries: queries ?? (query ? [query] : []),
        range: options.range || leftState.range,
        panelsState: options.panelsState,
      };
    }

    const urlState = serializeStateToUrlParam(rightUrlState);
    locationService.partial({ right: urlState }, true);
  };
};

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
    const path = await getExploreUrl({
      panel,
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
  correlations: undefined,
  richHistoryStorageFull: false,
  richHistoryLimitExceededWarningShown: false,
  richHistoryMigrationFailed: false,
  largerExploreId: undefined,
  maxedExploreId: undefined,
  evenSplitPanes: true,
};

/**
 * Global Explore reducer that handles multiple Explore areas (left and right).
 * Actions that have an `exploreId` get routed to the ExploreItemReducer.
 */
export const exploreReducer = (state = initialExploreState, action: AnyAction): ExploreState => {
  if (splitCloseAction.match(action)) {
    const { itemId } = action.payload;
    const targetSplit = {
      left: itemId === ExploreId.left ? state.right! : state.left,
      right: undefined,
    };
    return {
      ...state,
      ...targetSplit,
      largerExploreId: undefined,
      maxedExploreId: undefined,
      evenSplitPanes: true,
      syncedTimes: false,
    };
  }

  if (splitSizeUpdateAction.match(action)) {
    const { largerExploreId } = action.payload;
    return {
      ...state,
      largerExploreId,
      maxedExploreId: undefined,
      evenSplitPanes: largerExploreId === undefined,
    };
  }

  if (maximizePaneAction.match(action)) {
    const { exploreId } = action.payload;
    return {
      ...state,
      largerExploreId: exploreId,
      maxedExploreId: exploreId,
      evenSplitPanes: false,
    };
  }

  if (evenPaneResizeAction.match(action)) {
    return {
      ...state,
      largerExploreId: undefined,
      maxedExploreId: undefined,
      evenSplitPanes: true,
    };
  }

  if (saveCorrelationsAction.match(action)) {
    return {
      ...state,
      correlations: action.payload,
    };
  }

  if (syncTimesAction.match(action)) {
    return { ...state, syncedTimes: action.payload.syncedTimes };
  }

  if (richHistoryStorageFullAction.match(action)) {
    return {
      ...state,
      richHistoryStorageFull: true,
    };
  }

  if (richHistoryLimitExceededAction.match(action)) {
    return {
      ...state,
      richHistoryLimitExceededWarningShown: true,
    };
  }

  if (richHistoryMigrationFailedAction.match(action)) {
    return {
      ...state,
      richHistoryMigrationFailed: true,
    };
  }

  if (resetExploreAction.match(action)) {
    const leftState = state[ExploreId.left];
    const rightState = state[ExploreId.right];
    stopQueryState(leftState.querySubscription);
    if (rightState) {
      stopQueryState(rightState.querySubscription);
    }

    return {
      ...initialExploreState,
      left: {
        ...initialExploreItemState,
        queries: state.left.queries,
      },
    };
  }

  if (richHistorySettingsUpdatedAction.match(action)) {
    const richHistorySettings = action.payload;
    return {
      ...state,
      richHistorySettings,
    };
  }

  if (action.payload) {
    const { exploreId } = action.payload;
    if (exploreId !== undefined) {
      // @ts-ignore
      const explorePaneState = state[exploreId];
      return { ...state, [exploreId]: paneReducer(explorePaneState, action) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
