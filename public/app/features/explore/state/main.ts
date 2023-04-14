import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { SplitOpenOptions } from '@grafana/data';
import { DataSourceSrv, locationService } from '@grafana/runtime';
import { GetExploreUrlArguments } from 'app/core/utils/explore';
import { PanelModel } from 'app/features/dashboard/state';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';

import { RichHistoryResults } from '../../../core/history/RichHistoryStorage';
import { RichHistorySearchFilters, RichHistorySettings } from '../../../core/utils/richHistoryTypes';
import { createAsyncThunk, ThunkResult } from '../../../types';
import { CorrelationData } from '../../correlations/useCorrelations';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

import { initializeExplore, paneReducer } from './explorePane';
import { makeExplorePaneState } from './utils';

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
 * Close the pane with the given id.
 */
type SplitCloseActionPayload = ExploreId;
export const splitClose = createAction<SplitCloseActionPayload>('explore/splitClose');

export interface SetPaneStateActionPayload {
  [itemId: string]: Partial<ExploreItemState>;
}
export const setPaneState = createAction<SetPaneStateActionPayload>('explore/setPaneState');

export const clearPanes = createAction('explore/clearPanes');

//
// Action creators
//

/**
 * Opens a new right split pane by navigating to appropriate URL. It either copies existing state of the left pane
 * or uses values from options arg. This does only navigation each pane is then responsible for initialization from
 * the URL.
 */
export const splitOpen = createAsyncThunk(
  'explore/splitOpen',
  async (options: SplitOpenOptions | undefined, { getState, dispatch }) => {
    const leftState: ExploreItemState = getState().explore.panes.left!;

    dispatch(
      initializeExplore({
        exploreId: ExploreId.right,
        // TODO: fix this
        datasource: options?.datasourceUid || leftState.datasourceInstance?.uid!,
        queries: options?.queries ?? (options?.query ? [options?.query] : leftState.queries),
        range: options?.range || leftState.range.raw,
        panelsState: options?.panelsState || leftState.panelsState,
      })
    );
  }
);

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
  panes: {},
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
  if (splitClose.match(action)) {
    const panes = {
      left: action.payload === ExploreId.left ? state.panes.right : state.panes.left,
    };
    return {
      ...state,
      panes,
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

  if (richHistorySettingsUpdatedAction.match(action)) {
    const richHistorySettings = action.payload;
    return {
      ...state,
      richHistorySettings,
    };
  }

  if (splitOpen.pending.match(action)) {
    return {
      ...state,
      panes: {
        ...state.panes,
        right: initialExploreItemState,
      },
    };
  }

  if (initializeExplore.pending.match(action)) {
    return {
      ...state,
      panes: {
        ...state.panes,
        [action.meta.arg.exploreId]: initialExploreItemState,
      },
    };
  }

  if (clearPanes.match(action)) {
    return {
      ...state,
      panes: {},
    };
  }

  if (action.payload) {
    const { exploreId } = action.payload;
    if (exploreId !== undefined) {
      return {
        ...state,
        panes: Object.entries(state.panes).reduce<ExploreState['panes']>((panes, [id, pane]) => {
          if (id === exploreId) {
            panes[id as ExploreId] = paneReducer(pane, action);
          } else {
            panes[id as ExploreId] = pane;
          }
          return panes;
        }, {}),
      };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};
