import { createAction } from '@reduxjs/toolkit';
import { dateTimeForTimeZone, LoadingState } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import { getTimeRange, refreshIntervalToSortOrder, stopQueryState } from 'app/core/utils/explore';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { sortLogsResult } from 'app/features/logs/utils';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { syncTimesAction } from './main';
import { runQueries } from './query';
export const changeRangeAction = createAction('explore/changeRange');
export const changeRefreshInterval = createAction('explore/changeRefreshInterval');
export const updateTimeRange = (options) => {
    return (dispatch, getState) => {
        const { syncedTimes } = getState().explore;
        if (syncedTimes) {
            Object.keys(getState().explore.panes).forEach((exploreId) => {
                dispatch(updateTime(Object.assign(Object.assign({}, options), { exploreId })));
                dispatch(runQueries({ exploreId: exploreId, preserveCache: true }));
            });
        }
        else {
            dispatch(updateTime(Object.assign({}, options)));
            dispatch(runQueries({ exploreId: options.exploreId, preserveCache: true }));
        }
    };
};
export const updateTime = (config) => {
    return (dispatch, getState) => {
        const { exploreId, absoluteRange: absRange, rawRange: actionRange } = config;
        const itemState = getState().explore.panes[exploreId];
        const timeZone = getTimeZone(getState().user);
        const fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
        const { range: rangeInState } = itemState;
        let rawRange = rangeInState.raw;
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
        const absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
        // @deprecated - set because some internal plugins read the range this way; please use QueryEditorProps.range instead
        getTimeSrv().init({
            timepicker: {},
            getTimezone: () => timeZone,
            timeRangeUpdated(timeRange) { },
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
export function syncTimes(exploreId) {
    return (dispatch, getState) => {
        const range = getState().explore.panes[exploreId].range.raw;
        Object.keys(getState().explore.panes)
            .filter((key) => key !== exploreId)
            .forEach((exploreId) => {
            dispatch(updateTimeRange({ exploreId, rawRange: range }));
        });
        const isTimeSynced = getState().explore.syncedTimes;
        dispatch(syncTimesAction({ syncedTimes: !isTimeSynced }));
    };
}
function modifyExplorePanesTimeRange(modifier) {
    return (dispatch, getState) => {
        const timeZone = getTimeZone(getState().user);
        const fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
        Object.entries(getState().explore.panes).forEach(([exploreId, exploreItemState]) => {
            const range = getTimeRange(timeZone, exploreItemState.range.raw, fiscalYearStartMonth);
            modifier(exploreId, exploreItemState, range, dispatch);
        });
    };
}
/**
 * Forces the timepicker's time into absolute time.
 * The conversion is applied to all Explore panes.
 * Useful to produce a bookmarkable URL that points to the same data.
 */
export function makeAbsoluteTime() {
    return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
        const absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
        dispatch(updateTimeRange({ exploreId, absoluteRange }));
    });
}
export function shiftTime(direction) {
    return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
        const shiftedRange = getShiftedTimeRange(direction, range);
        dispatch(updateTimeRange({ exploreId, absoluteRange: shiftedRange }));
    });
}
export function zoomOut(scale) {
    return modifyExplorePanesTimeRange((exploreId, exploreItemState, range, dispatch) => {
        const zoomedRange = getZoomedTimeRange(range, scale);
        dispatch(updateTimeRange({ exploreId, absoluteRange: zoomedRange }));
    });
}
/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const timeReducer = (state, action) => {
    if (changeRefreshInterval.match(action)) {
        const { refreshInterval } = action.payload;
        const live = RefreshPicker.isLive(refreshInterval);
        const sortOrder = refreshIntervalToSortOrder(refreshInterval);
        const logsResult = sortLogsResult(state.logsResult, sortOrder);
        if (RefreshPicker.isLive(state.refreshInterval) && !live) {
            stopQueryState(state.querySubscription);
        }
        return Object.assign(Object.assign({}, state), { refreshInterval, queryResponse: Object.assign(Object.assign({}, state.queryResponse), { state: live ? LoadingState.Streaming : LoadingState.Done }), isLive: live, isPaused: live ? false : state.isPaused, logsResult });
    }
    if (changeRangeAction.match(action)) {
        const { range, absoluteRange } = action.payload;
        return Object.assign(Object.assign({}, state), { range,
            absoluteRange });
    }
    return state;
};
//# sourceMappingURL=time.js.map