import _ from 'lodash';
import { AnyAction } from 'redux';
import { LocationUpdate } from '@grafana/runtime';

import { stopQueryState, parseUrlState, DEFAULT_RANGE } from 'app/core/utils/explore';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';
import { updateLocation } from '../../../core/actions';
import { initialExploreItemState, itemReducer } from './exploreItem';
import { createAction } from '@reduxjs/toolkit';

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

export const initialExploreState: ExploreState = {
  split: false,
  syncedTimes: false,
  left: initialExploreItemState,
  right: initialExploreItemState,
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
      left: itemId === ExploreId.left ? state.right : state.left,
      right: initialExploreState.right,
    };
    return {
      ...state,
      ...targetSplit,
      split: false,
    };
  }

  if (splitOpenAction.match(action)) {
    return { ...state, split: true, right: { ...action.payload.itemState } };
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
    stopQueryState(rightState.querySubscription);

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

  if (updateLocation.match(action)) {
    const payload: LocationUpdate = action.payload;
    const { query } = payload;
    if (!query || !query[ExploreId.left]) {
      return state;
    }

    const split = query[ExploreId.right] ? true : false;
    const leftState = state[ExploreId.left];
    const rightState = state[ExploreId.right];

    return {
      ...state,
      split,
      [ExploreId.left]: updateChildRefreshState(leftState, payload, ExploreId.left),
      [ExploreId.right]: updateChildRefreshState(rightState, payload, ExploreId.right),
    };
  }

  if (action.payload) {
    const { exploreId } = action.payload;
    if (exploreId !== undefined) {
      // @ts-ignore
      const exploreItemState = state[exploreId];
      return { ...state, [exploreId]: itemReducer(exploreItemState, action as any) };
    }
  }

  return state;
};

export default {
  explore: exploreReducer,
};

export const updateChildRefreshState = (
  state: Readonly<ExploreItemState>,
  payload: LocationUpdate,
  exploreId: ExploreId
): ExploreItemState => {
  const path = payload.path || '';
  if (!payload.query) {
    return state;
  }

  const queryState = payload.query[exploreId] as string;
  if (!queryState) {
    return state;
  }

  const urlState = parseUrlState(queryState);
  if (!state.urlState || path !== '/explore') {
    // we only want to refresh when browser back/forward
    return {
      ...state,
      urlState,
      update: { datasource: false, queries: false, range: false, mode: false },
    };
  }

  const datasource = _.isEqual(urlState ? urlState.datasource : '', state.urlState.datasource) === false;
  const queries = _.isEqual(urlState ? urlState.queries : [], state.urlState.queries) === false;
  const range = _.isEqual(urlState ? urlState.range : DEFAULT_RANGE, state.urlState.range) === false;

  return {
    ...state,
    urlState,
    update: {
      ...state.update,
      datasource,
      queries,
      range,
    },
  };
};
