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
  return (dispatch) => {
    deleteAllFromRichHistory();
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
