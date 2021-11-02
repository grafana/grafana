import { __assign } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { dateTimeForTimeZone, LoadingState, sortLogsResult, } from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';
import { getTimeRange, refreshIntervalToSortOrder, stopQueryState } from 'app/core/utils/explore';
import { ExploreId } from 'app/types/explore';
import { getFiscalYearStartMonth, getTimeZone } from 'app/features/profile/state/selectors';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { runQueries } from './query';
import { syncTimesAction, stateSave } from './main';
export var changeRangeAction = createAction('explore/changeRange');
export var changeRefreshIntervalAction = createAction('explore/changeRefreshInterval');
export var updateTimeRange = function (options) {
    return function (dispatch, getState) {
        var syncedTimes = getState().explore.syncedTimes;
        if (syncedTimes) {
            dispatch(updateTime(__assign(__assign({}, options), { exploreId: ExploreId.left })));
            // When running query by updating time range, we want to preserve cache.
            // Cached results are currently used in Logs pagination.
            dispatch(runQueries(ExploreId.left, { preserveCache: true }));
            dispatch(updateTime(__assign(__assign({}, options), { exploreId: ExploreId.right })));
            dispatch(runQueries(ExploreId.right, { preserveCache: true }));
        }
        else {
            dispatch(updateTime(__assign({}, options)));
            dispatch(runQueries(options.exploreId, { preserveCache: true }));
        }
    };
};
/**
 * Change the refresh interval of Explore. Called from the Refresh picker.
 */
export function changeRefreshInterval(exploreId, refreshInterval) {
    return changeRefreshIntervalAction({ exploreId: exploreId, refreshInterval: refreshInterval });
}
export var updateTime = function (config) {
    return function (dispatch, getState) {
        var exploreId = config.exploreId, absRange = config.absoluteRange, actionRange = config.rawRange;
        var itemState = getState().explore[exploreId];
        var timeZone = getTimeZone(getState().user);
        var fiscalYearStartMonth = getFiscalYearStartMonth(getState().user);
        var rangeInState = itemState.range;
        var rawRange = rangeInState.raw;
        if (absRange) {
            rawRange = {
                from: dateTimeForTimeZone(timeZone, absRange.from),
                to: dateTimeForTimeZone(timeZone, absRange.to),
            };
        }
        if (actionRange) {
            rawRange = actionRange;
        }
        var range = getTimeRange(timeZone, rawRange, fiscalYearStartMonth);
        var absoluteRange = { from: range.from.valueOf(), to: range.to.valueOf() };
        getTimeSrv().init(new DashboardModel({
            time: range.raw,
            refresh: false,
            timeZone: timeZone,
        }));
        dispatch(changeRangeAction({ exploreId: exploreId, range: range, absoluteRange: absoluteRange }));
    };
};
/**
 * Syncs time interval, if they are not synced on both panels in a split mode.
 * Unsyncs time interval, if they are synced on both panels in a split mode.
 */
export function syncTimes(exploreId) {
    return function (dispatch, getState) {
        if (exploreId === ExploreId.left) {
            var leftState = getState().explore.left;
            dispatch(updateTimeRange({ exploreId: ExploreId.right, rawRange: leftState.range.raw }));
        }
        else {
            var rightState = getState().explore.right;
            dispatch(updateTimeRange({ exploreId: ExploreId.left, rawRange: rightState.range.raw }));
        }
        var isTimeSynced = getState().explore.syncedTimes;
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
export var timeReducer = function (state, action) {
    if (changeRefreshIntervalAction.match(action)) {
        var refreshInterval = action.payload.refreshInterval;
        var live = RefreshPicker.isLive(refreshInterval);
        var sortOrder = refreshIntervalToSortOrder(refreshInterval);
        var logsResult = sortLogsResult(state.logsResult, sortOrder);
        if (RefreshPicker.isLive(state.refreshInterval) && !live) {
            stopQueryState(state.querySubscription);
        }
        return __assign(__assign({}, state), { refreshInterval: refreshInterval, queryResponse: __assign(__assign({}, state.queryResponse), { state: live ? LoadingState.Streaming : LoadingState.Done }), isLive: live, isPaused: live ? false : state.isPaused, loading: live, logsResult: logsResult });
    }
    if (changeRangeAction.match(action)) {
        var _a = action.payload, range = _a.range, absoluteRange = _a.absoluteRange;
        return __assign(__assign({}, state), { range: range, absoluteRange: absoluteRange });
    }
    return state;
};
//# sourceMappingURL=time.js.map