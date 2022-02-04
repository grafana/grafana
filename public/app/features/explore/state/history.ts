import {
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  updateCommentInRichHistory,
  updateStarredInRichHistory,
} from 'app/core/utils/richHistory';
import { ExploreId, ExploreItemState, ThunkResult } from 'app/types';
import { richHistoryUpdatedAction } from './main';
import { HistoryItem } from '@grafana/data';
import { AnyAction, createAction } from '@reduxjs/toolkit';

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

export const updateRichHistory = (id: string, property: string, updatedProperty?: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    // Side-effect: Saving rich history in localstorage
    let nextRichHistory;
    if (property === 'starred') {
      nextRichHistory = await updateStarredInRichHistory(getState().explore.richHistory, id);
    }
    if (property === 'comment') {
      nextRichHistory = await updateCommentInRichHistory(getState().explore.richHistory, id, updatedProperty);
    }
    if (property === 'delete') {
      nextRichHistory = await deleteQueryInRichHistory(getState().explore.richHistory, id);
    }
    dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
  };
};

export const deleteRichHistory = (): ThunkResult<void> => {
  return async (dispatch) => {
    await deleteAllFromRichHistory();
    dispatch(richHistoryUpdatedAction({ richHistory: [] }));
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
