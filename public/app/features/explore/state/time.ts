import { AnyAction, createAction } from '@reduxjs/toolkit';

import {
  AbsoluteTimeRange,
  AppEvents,
  dateTimeForTimeZone,
  LoadingState,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { getTimeRange, refreshIntervalToSortOrder, stopQueryState } from 'app/core/utils/explore';
import { getCopiedTimeRange, getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { sortLogsResult } from 'app/features/logs/utils';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { ExploreItemState, ThunkDispatch, ThunkResult } from 'app/types';

import { syncTimesAction } from './main';
import { runLoadMoreLogsQueries, runQueries } from './query';

//
// Actions and Payloads
//

export interface ChangeRangePayload {
  exploreId: string;
  range: TimeRange;
  absoluteRange: AbsoluteTimeRange;
}

export const changeRangeAction = createAction<ChangeRangePayload>('explore/changeRange');

/**
 * Change the time range of Explore. Usually called from the Timepicker or a graph interaction.
 */
export interface ChangeRefreshIntervalPayload {
  exploreId: string;
  refreshInterval: string;
}

export const changeRefreshInterval = createAction<ChangeRefreshIntervalPayload>('explore/changeRefreshInterval');

export const updateTimeRange = (options: {
  exploreId: string;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { syncedTimes } = getState().explore;
    if (syncedTimes) {
      Object.keys(getState().explore.panes).forEach((exploreId) => {
        dispatch(updateTime({ ...options, exploreId }));
        dispatch(runQueries({ exploreId: exploreId, preserveCache: true }));
      });
    } else {
      dispatch(updateTime({ ...options }));
      dispatch(runQueries({ exploreId: options.exploreId, preserveCache: true }));
    }
  };
};

export const loadMoreLogs = (options: { exploreId: string; absoluteRange: AbsoluteTimeRange }): ThunkResult<void> => {
  return (dispatch) => {
    dispatch(runLoadMoreLogsQueries({ ...options }));
  };
};

export const updateTime = (config: {
  exploreId: string;
  rawRange?: RawTimeRange;
  absoluteRange?: AbsoluteTimeRange;
}): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { exploreId, absoluteRange: absRange, rawRange: actionRange } = config;
    const itemState = getState().explore.panes[exploreId]!;
    const timeZone = getTimeZone(getState().user);
    const fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
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

    const range = getTimeRange(timeZone, rawRange, fiscalYearStartMonth);
    const absoluteRange: AbsoluteTimeRange = { from: range.from.valueOf(), to: range.to.valueOf() };

    // @deprecated - set because some internal plugins read the range this way; please use QueryEditorProps.range instead
    getTimeSrv().init({
      timepicker: {},
      getTimezone: () => timeZone,
      timeRangeUpdated(timeRange) {},
      time: range.raw,
    });
    // After re-initializing TimeSrv we need to update the time range in Template service for interpolation
    // of __from and __to variables
    getTemplateSrv().updateTimeRange(range);

    dispatch(changeRangeAction({ exploreId, range, absoluteRange }));
  };
};

/**
 * Syncs time interval, if they are not synced on both panels in a split mode.
 * Unsyncs time interval, if they are synced on both panels in a split mode.
 */
export function syncTimes(exploreId: string): ThunkResult<void> {
  return (dispatch, getState) => {
    const range = getState().explore.panes[exploreId]!.range.raw;

    Object.keys(getState().explore.panes)
      .filter((key) => key !== exploreId)
      .forEach((exploreId) => {
        dispatch(updateTimeRange({ exploreId, rawRange: range }));
      });

    const isTimeSynced = getState().explore.syncedTimes;
    dispatch(syncTimesAction({ syncedTimes: !isTimeSynced }));
  };
}

function modifyExplorePanesTimeRange(
  modifier: (
    exploreId: string,
    exploreItemState: ExploreItemState,
    currentTimeRange: TimeRange,
    dispatch: ThunkDispatch
  ) => void
): ThunkResult<void> {
  return (dispatch, getState) => {
    const timeZone = getTimeZone(getState().user);
    const fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);

    Object.entries(getState().explore.panes).forEach(([exploreId, exploreItemState]) => {
      const range = getTimeRange(timeZone, exploreItemState!.range.raw, fiscalYearStartMonth);
      modifier(exploreId, exploreItemState!, range, dispatch);
    });
  };
}

/**
 * Forces the timepicker's time into absolute time.
 * The conversion is applied to all Explore panes.
 * Useful to produce a bookmarkable URL that points to the same data.
 */
export function makeAbsoluteTime(): ThunkResult<void> {
  return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
    const absoluteRange: AbsoluteTimeRange = { from: range.from.valueOf(), to: range.to.valueOf() };
    dispatch(updateTimeRange({ exploreId, absoluteRange }));
  });
}

export function shiftTime(direction: number): ThunkResult<void> {
  return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
    const shiftedRange = getShiftedTimeRange(direction, range);
    dispatch(updateTimeRange({ exploreId, absoluteRange: shiftedRange }));
  });
}

export function zoomOut(scale: number): ThunkResult<void> {
  return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
    const zoomedRange = getZoomedTimeRange(range, scale);
    dispatch(updateTimeRange({ exploreId, absoluteRange: zoomedRange }));
  });
}

export function copyTimeRangeToClipboard(): ThunkResult<void> {
  return (dispatch, getState) => {
    const range = getState().explore.panes[Object.keys(getState().explore.panes)[0]]!.range.raw;
    navigator.clipboard.writeText(JSON.stringify(range));

    appEvents.emit(AppEvents.alertSuccess, [
      t('time-picker.copy-paste.copy-success-message', 'Time range copied to clipboard'),
    ]);
  };
}

export function pasteTimeRangeFromClipboard(): ThunkResult<void> {
  return async (dispatch, getState) => {
    const { range, isError } = await getCopiedTimeRange();

    if (isError === true) {
      appEvents.emit(AppEvents.alertError, [
        t('time-picker.copy-paste.default-error-title', 'Invalid time range'),
        t('time-picker.copy-paste.default-error-message', `{{error}} is not a valid time range`, { error: range }),
      ]);
      return;
    }

    const panesSynced = getState().explore.syncedTimes;

    if (panesSynced) {
      dispatch(updateTimeRange({ exploreId: Object.keys(getState().explore.panes)[0], rawRange: range }));
      dispatch(updateTimeRange({ exploreId: Object.keys(getState().explore.panes)[1], rawRange: range }));
      return;
    }

    dispatch(updateTimeRange({ exploreId: Object.keys(getState().explore.panes)[0], rawRange: range }));
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
  if (changeRefreshInterval.match(action)) {
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
