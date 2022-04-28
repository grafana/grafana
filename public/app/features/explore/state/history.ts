import { AnyAction, createAction } from '@reduxjs/toolkit';

import { DataQuery, HistoryItem } from '@grafana/data';
import {
  addToRichHistory,
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  getRichHistory,
  getRichHistorySettings,
  updateCommentInRichHistory,
  updateRichHistorySettings,
  updateStarredInRichHistory,
} from 'app/core/utils/richHistory';
import { ExploreId, ExploreItemState, ExploreState, RichHistoryQuery, ThunkResult } from 'app/types';

import { RichHistorySearchFilters, RichHistorySettings } from '../../../core/utils/richHistoryTypes';

import {
  richHistoryLimitExceededAction,
  richHistorySearchFiltersUpdatedAction,
  richHistorySettingsUpdatedAction,
  richHistoryStorageFullAction,
  richHistoryUpdatedAction,
} from './main';

//
// Actions and Payloads
//

export interface HistoryUpdatedPayload {
  exploreId: ExploreId;
  history: HistoryItem[];
}
export const historyUpdatedAction = createAction<HistoryUpdatedPayload>('explore/historyUpdated');

//
// Action creators
//

type SyncHistoryUpdatesOptions = {
  updatedQuery?: RichHistoryQuery;
  deletedId?: string;
};

/**
 * Updates current state in both Explore panes after changing or deleting a query history item
 */
const updateRichHistoryState = ({ updatedQuery, deletedId }: SyncHistoryUpdatesOptions): ThunkResult<void> => {
  return async (dispatch, getState) => {
    forEachExplorePane(getState().explore, (item, exploreId) => {
      const newRichHistory = item.richHistory
        // update
        .map((query) => (query.id === updatedQuery?.id ? updatedQuery : query))
        // or remove
        .filter((query) => query.id !== deletedId);
      dispatch(richHistoryUpdatedAction({ richHistory: newRichHistory, exploreId }));
    });
  };
};

const forEachExplorePane = (state: ExploreState, callback: (item: ExploreItemState, exploreId: ExploreId) => void) => {
  callback(state.left, ExploreId.left);
  state.right && callback(state.right, ExploreId.right);
};

export const addHistoryItem = (
  datasourceUid: string,
  datasourceName: string,
  queries: DataQuery[]
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { richHistoryStorageFull, limitExceeded } = await addToRichHistory(
      datasourceUid,
      datasourceName,
      queries,
      false,
      '',
      !getState().explore.richHistoryStorageFull,
      !getState().explore.richHistoryLimitExceededWarningShown
    );
    if (richHistoryStorageFull) {
      dispatch(richHistoryStorageFullAction());
    }
    if (limitExceeded) {
      dispatch(richHistoryLimitExceededAction());
    }
  };
};

export const starHistoryItem = (id: string, starred: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const updatedQuery = await updateStarredInRichHistory(id, starred);
    dispatch(updateRichHistoryState({ updatedQuery }));
  };
};

export const commentHistoryItem = (id: string, comment?: string): ThunkResult<void> => {
  return async (dispatch) => {
    const updatedQuery = await updateCommentInRichHistory(id, comment);
    dispatch(updateRichHistoryState({ updatedQuery }));
  };
};

export const deleteHistoryItem = (id: string): ThunkResult<void> => {
  return async (dispatch) => {
    const deletedId = await deleteQueryInRichHistory(id);
    dispatch(updateRichHistoryState({ deletedId }));
  };
};

export const deleteRichHistory = (): ThunkResult<void> => {
  return async (dispatch) => {
    await deleteAllFromRichHistory();
    dispatch(richHistoryUpdatedAction({ richHistory: [], exploreId: ExploreId.left }));
    dispatch(richHistoryUpdatedAction({ richHistory: [], exploreId: ExploreId.right }));
  };
};

export const loadRichHistory = (exploreId: ExploreId): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const filters = getState().explore![exploreId]?.richHistorySearchFilters;
    if (filters) {
      const richHistory = await getRichHistory(filters);
      dispatch(richHistoryUpdatedAction({ richHistory, exploreId }));
    }
  };
};

export const clearRichHistoryResults = (exploreId: ExploreId): ThunkResult<void> => {
  return async (dispatch) => {
    dispatch(richHistorySearchFiltersUpdatedAction({ filters: undefined, exploreId }));
    dispatch(richHistoryUpdatedAction({ richHistory: [], exploreId }));
  };
};

/**
 * Initialize query history pane. To load history it requires settings to be loaded first
 * (but only once per session). Filters are initialised by the tab (starred or home).
 */
export const initRichHistory = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    let settings = getState().explore.richHistorySettings;
    if (!settings) {
      settings = await getRichHistorySettings();
      dispatch(richHistorySettingsUpdatedAction(settings));
    }
  };
};

export const updateHistorySettings = (settings: RichHistorySettings): ThunkResult<void> => {
  return async (dispatch) => {
    dispatch(richHistorySettingsUpdatedAction(settings));
    await updateRichHistorySettings(settings);
  };
};

/**
 * Assumed this can be called only when settings and filters are initialised
 */
export const updateHistorySearchFilters = (
  exploreId: ExploreId,
  filters: RichHistorySearchFilters
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    await dispatch(richHistorySearchFiltersUpdatedAction({ exploreId, filters: { ...filters } }));
    const currentSettings = getState().explore.richHistorySettings!;
    await dispatch(
      updateHistorySettings({
        ...currentSettings,
        lastUsedDatasourceFilters: filters.datasourceFilters,
      })
    );
  };
};

export const historyReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (historyUpdatedAction.match(action)) {
    return {
      ...state,
      history: action.payload.history,
    };
  }
  return state;
};
