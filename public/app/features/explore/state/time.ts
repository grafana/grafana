import { AnyAction, createAction, PayloadAction } from '@reduxjs/toolkit';
import {
  AbsoluteTimeRange,
  dateTimeForTimeZone,
  LoadingState,
  RawTimeRange,
  sortLogsResult,
  TimeRange,
} from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';

import { getTimeRange, refreshIntervalToSortOrder, stopQueryState } from 'app/core/utils/explore';
import { ExploreItemState, ThunkResult } from 'app/types';
import { ExploreId } from 'app/types/explore';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { runQueries } from './query';
import { syncTimesAction, stateSave } from './main';

//
// Actions and Payloads
//

export interface ChangeRangePayload {
  exploreId: ExploreId;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
}
export const changeRangeAction = createAction<ChangeRangePayload>('explore/changeRange');

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export interface ChangeRefreshIntervalPayload {
  exploreId: ExploreId;
  refreshInterval: string;
}
export const changeRefreshIntervalAction = createAction<ChangeRefreshIntervalPayload>('explore/changeRefreshInterval');

export const updateTimeRange = (options: {
  exploreId: ExploreId;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { syncedTimes } = getState().explore;
    if (syncedTimes) {
      dispatch(updateTime({ ...options, exploreId: ExploreId.left }));
      // When running query by updating time range, we want to preserve cache.
      // Cached results are currently used in Logs pagination.
      dispatch(runQueries(ExploreId.left, { preserveCache: true }));
      dispatch(updateTime({ ...options, exploreId: ExploreId.right }));
      dispatch(runQueries(ExploreId.right, { preserveCache: true }));
    } else {
      dispatch(updateTime({ ...options }));
      dispatch(runQueries(options.exploreId, { preserveCache: true }));
    }
  };
};

/**
 * Change the refresh interval of Explore. Called from the Refresh picker.
 */
export function changeRefreshInterval(
  exploreId: ExploreId,
  refreshInterval: string
): PayloadAction<ChangeRefreshIntervalPayload> {
  return changeRefreshIntervalAction({ exploreId, refreshInterval });
}

export const updateTime = (config: {
  exploreId: ExploreId;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { exploreId, absoluteRange: absRange, rawRange: actionRange } = config;
    const itemState = getState().explore[exploreId]!;
    const timeZone = getTimeZone(getState().user);
    const { range: rangeInState } = itemState;
    let rawRange: RawTimeRange = rangeInState.raw;

    if (absRange) {
      rawRange = {
        from: dateTimeForTimeZone(timeZone, absRange.from),
        to: dateTimeForTimeZone(timeZone, absRange.to),
      };
    }

    if (actionRange) {
      rawRange = actionRange;
    }

    const range = getTimeRange(timeZone, rawRange);
    const absoluteRange: AbsoluteTimeRange = { from: range.from.valueOf(), to: range.to.valueOf() };

    getTimeSrv().init(
      new DashboardModel({
        time: range.raw,
        refresh: false,
        timeZone,
      })
    );

    dispatch(changeRangeAction({ exploreId, range, absoluteRange }));
  };
};

/**
 * Syncs time interval, if they are not synced on both panels in a split mode.
 * Unsyncs time interval, if they are synced on both panels in a split mode.
 */
export function syncTimes(exploreId: ExploreId): ThunkResult<void> {
  return (dispatch, getState) => {
    if (exploreId === ExploreId.left) {
      const leftState = getState().explore.left;
      dispatch(updateTimeRange({ exploreId: ExploreId.right, rawRange: leftState.range.raw }));
    } else {
      const rightState = getState().explore.right!;
      dispatch(updateTimeRange({ exploreId: ExploreId.left, rawRange: rightState.range.raw }));
    }
    const isTimeSynced = getState().explore.syncedTimes;
    dispatch(syncTimesAction({ syncedTimes: !isTimeSynced }));
    dispatch(stateSave());
  };
}

/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const timeReducer = (state: ExploreItemState, action: AnyAction): ExploreItemState => {
  if (changeRefreshIntervalAction.match(action)) {
    const { refreshInterval } = action.payload;
    const live = RefreshPicker.isLive(refreshInterval);
    const sortOrder = refreshIntervalToSortOrder(refreshInterval);
    const logsResult = sortLogsResult(state.logsResult, sortOrder);

    if (RefreshPicker.isLive(state.refreshInterval) && !live) {
      stopQueryState(state.querySubscription);
    }

    return {
      ...state,
      refreshInterval,
      queryResponse: {
        ...state.queryResponse,
        state: live ? LoadingState.Streaming : LoadingState.Done,
      },
      isLive: live,
      isPaused: live ? false : state.isPaused,
      loading: live,
      logsResult,
    };
  }

  if (changeRangeAction.match(action)) {
    const { range, absoluteRange } = action.payload;
    return {
      ...state,
      range,
      absoluteRange,
    };
  }

  return state;
};
