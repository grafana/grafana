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

export const starHistoryItem = (id: string, starred: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const nextRichHistory = await updateStarredInRichHistory(getState().explore.richHistory, id, starred);
    dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
  };
};

export const commentHistoryItem = (id: string, comment?: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const nextRichHistory = await updateCommentInRichHistory(getState().explore.richHistory, id, comment);
    dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
  };
};

export const deleteHistoryItem = (id: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const nextRichHistory = await deleteQueryInRichHistory(getState().explore.richHistory, id);
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
