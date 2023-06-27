import { createAction } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

import { SplitOpenOptions } from '@grafana/data';
import { DataSourceSrv, locationService } from '@grafana/runtime';
import { generateExploreId, GetExploreUrlArguments } from 'app/core/utils/explore';
import { PanelModel } from 'app/features/dashboard/state';
import { ExploreItemState, ExploreState } from 'app/types/explore';

import { RichHistoryResults } from '../../../core/history/RichHistoryStorage';
import { RichHistorySearchFilters, RichHistorySettings } from '../../../core/utils/richHistoryTypes';
import { createAsyncThunk, ThunkResult } from '../../../types';
import { TimeSrv } from '../../dashboard/services/TimeSrv';
import { withUniqueRefIds } from '../utils/queries';

import { initializeExplore, InitializeExploreOptions, paneReducer } from './explorePane';
import { DEFAULT_RANGE, makeExplorePaneState } from './utils';

//
// Actions and Payloads
//

export interface SyncTimesPayload {
  syncedTimes: boolean;
}
export const syncTimesAction = createAction<SyncTimesPayload>('explore/syncTimes');

export const richHistoryUpdatedAction = createAction<{ richHistoryResults: RichHistoryResults; exploreId: string }>(
  'explore/richHistoryUpdated'
);
export const richHistoryStorageFullAction = createAction('explore/richHistoryStorageFullAction');
export const richHistoryLimitExceededAction = createAction('explore/richHistoryLimitExceededAction');

export const richHistorySettingsUpdatedAction = createAction<RichHistorySettings>('explore/richHistorySettingsUpdated');
export const richHistorySearchFiltersUpdatedAction = createAction<{
  exploreId: string;
  filters?: RichHistorySearchFilters;
}>('explore/richHistorySearchFiltersUpdatedAction');

export const splitSizeUpdateAction = createAction<{
  largerExploreId?: string;
}>('explore/splitSizeUpdateAction');

export const maximizePaneAction = createAction<{
  exploreId?: string;
}>('explore/maximizePaneAction');

export const evenPaneResizeAction = createAction('explore/evenPaneResizeAction');

/**
 * Close the pane with the given id.
 */
export const splitClose = createAction<string>('explore/splitClose');

export interface SetPaneStateActionPayload {
  [itemId: string]: Partial<ExploreItemState>;
}
export const setPaneState = createAction<SetPaneStateActionPayload>('explore/setPaneState');

export const clearPanes = createAction('explore/clearPanes');

/**
 * Ensure Explore doesn't exceed supported number of panes and initializes the new pane.
 */
export const splitOpen = createAsyncThunk(
  'explore/splitOpen',
  async (options: SplitOpenOptions | undefined, { getState, dispatch, requestId }) => {
    // we currently support showing only 2 panes in explore, so if this action is dispatched we know it has been dispatched from the "first" pane.
    const originState = Object.values(getState().explore.panes)[0];

    const queries = options?.queries ?? (options?.query ? [options?.query] : originState?.queries || []);

    Object.keys(getState().explore.panes).forEach((paneId, index) => {
      // Only 2 panes are supported. Remove panes before create a new one.
      if (index >= 1) {
        dispatch(splitClose(paneId));
      }
    });

    await dispatch(
      createNewSplitOpenPane({
        exploreId: requestId,
        datasource: options?.datasourceUid || originState?.datasourceInstance?.getRef(),
        queries: withUniqueRefIds(queries),
        range: options?.range || originState?.range.raw || DEFAULT_RANGE,
        panelsState: options?.panelsState || originState?.panelsState,
      })
    );
  },
  {
    idGenerator: generateExploreId,
  }
);

/**
 * Opens a new split pane. It either copies existing state of an already present pane
 * or uses values from options arg.
 *
 * TODO: this can be improved by better inferring fallback values.
 */
const createNewSplitOpenPane = createAsyncThunk(
  'explore/createNewSplitOpen',
  async (options: InitializeExploreOptions, { dispatch }) => {
    await dispatch(initializeExplore(options));
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
  richHistoryStorageFull: false,
  richHistoryLimitExceededWarningShown: false,
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
    const { [action.payload]: _, ...panes } = { ...state.panes };

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

  if (richHistorySettingsUpdatedAction.match(action)) {
    const richHistorySettings = action.payload;
    return {
      ...state,
      richHistorySettings,
    };
  }

  if (createNewSplitOpenPane.pending.match(action)) {
    return {
      ...state,
      panes: {
        ...state.panes,
        [action.meta.arg.exploreId]: initialExploreItemState,
      },
    };
  }

  if (initializeExplore.pending.match(action)) {
    const initialPanes = Object.entries(state.panes);
    const before = initialPanes.slice(0, action.meta.arg.position);
    const after = initialPanes.slice(before.length);
    const panes = [...before, [action.meta.arg.exploreId, initialExploreItemState] as const, ...after].reduce(
      (acc, [id, pane]) => ({ ...acc, [id]: pane }),
      {}
    );

    return {
      ...state,
      panes,
    };
  }

  if (clearPanes.match(action)) {
    return {
      ...state,
      panes: {},
    };
  }

  const exploreId: string | undefined = action.payload?.exploreId;
  if (typeof exploreId === 'string') {
    return {
      ...state,
      panes: Object.entries(state.panes).reduce((acc, [id, pane]) => {
        return {
          ...acc,
          [id]: id === exploreId ? paneReducer(pane, action) : pane,
        };
      }, {}),
    };
  }

  return state;
};

export default {
  explore: exploreReducer,
};
