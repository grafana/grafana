import { createAction } from '@reduxjs/toolkit';

import { HistoryItem } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
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
import { RichHistoryQuery } from 'app/types/explore';
import { ThunkResult } from 'app/types/store';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
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
    const richHistory = getState().explore.richHistory;

    // update or remove entries
    const newRichHistory = richHistory
      .map((query) => (query.id === updatedQuery?.id ? updatedQuery : query))
      .filter((query) => query.id !== deletedId);

    const deletedItems = richHistory.length - newRichHistory.length;
    dispatch(
      richHistoryUpdatedAction({
        richHistoryResults: {
          richHistory: newRichHistory,
          total: getState().explore.richHistoryTotal! - deletedItems,
        },
      })
    );
  };
};

export const addHistoryItem = (
  localOverride: boolean,
  datasourceUid: string,
  datasourceName: string,
  queries: DataQuery[],
  hideAllErrorsAndWarnings: boolean
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const showNotif = hideAllErrorsAndWarnings
      ? { quotaExceededError: false, limitExceededWarning: false, otherErrors: false }
      : {
          quotaExceededError: !getState().explore.richHistoryStorageFull,
          limitExceededWarning: !getState().explore.richHistoryLimitExceededWarningShown,
        };
    const { richHistoryStorageFull, limitExceeded } = await addToRichHistory({
      localOverride,
      datasource: { uid: datasourceUid, name: datasourceName },
      queries,
      starred: false,
      showNotif,
    });
    if (!hideAllErrorsAndWarnings) {
      if (richHistoryStorageFull) {
        dispatch(richHistoryStorageFullAction());
      }
      if (limitExceeded) {
        dispatch(richHistoryLimitExceededAction());
      }
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
    dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 } }));
    dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 } }));
  };
};

export const loadRichHistory = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const filters = getState().explore.richHistorySearchFilters;
    if (filters) {
      const richHistoryResults = await getRichHistory(filters);
      dispatch(richHistoryUpdatedAction({ richHistoryResults }));
    }
  };
};

export const loadMoreRichHistory = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const currentFilters = getState().explore.richHistorySearchFilters;
    const currentRichHistory = getState().explore.richHistory;
    if (currentFilters && currentRichHistory) {
      const nextFilters = { ...currentFilters, page: (currentFilters?.page || 1) + 1 };
      const moreRichHistory = await getRichHistory(nextFilters);
      const richHistory = [...currentRichHistory, ...moreRichHistory.richHistory];
      dispatch(richHistorySearchFiltersUpdatedAction({ filters: nextFilters }));
      dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory, total: moreRichHistory.total } }));
    }
  };
};

export const clearRichHistoryResults = (): ThunkResult<void> => {
  return async (dispatch) => {
    dispatch(richHistorySearchFiltersUpdatedAction({ filters: undefined }));
    dispatch(richHistoryUpdatedAction({ richHistoryResults: { richHistory: [], total: 0 } }));
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
export const updateHistorySearchFilters = (filters: RichHistorySearchFilters): ThunkResult<void> => {
  return async (dispatch, getState) => {
    await dispatch(richHistorySearchFiltersUpdatedAction({ filters: { ...filters } }));
    const currentSettings = getState().explore.richHistorySettings!;
    if (supportedFeatures().lastUsedDataSourcesAvailable) {
      await dispatch(
        updateHistorySettings({
          ...currentSettings,
          lastUsedDatasourceFilters: filters.datasourceFilters,
        })
      );
    }
  };
};
