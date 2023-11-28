import { cloneDeep, extend, isString } from 'lodash';
import { dateMath, dateTime, getDefaultTimeRange, isDateTime, rangeUtil, toUtc, } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { config } from 'app/core/config';
import { AutoRefreshInterval, contextSrv } from 'app/core/services/context_srv';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { AbsoluteTimeEvent, ShiftTimeEvent, ZoomOutEvent } from '../../../types/events';
import { getRefreshFromUrl } from '../utils/getRefreshFromUrl';
export class TimeSrv {
    constructor(contextSrv) {
        this.contextSrv = contextSrv;
        this.timeRangeForUrl = () => {
            const range = this.timeRange().raw;
            if (isDateTime(range.from)) {
                range.from = range.from.valueOf().toString();
            }
            if (isDateTime(range.to)) {
                range.to = range.to.valueOf().toString();
            }
            return range;
        };
        // default time
        this.time = getDefaultTimeRange().raw;
        this.timeAtLoad = getDefaultTimeRange().raw;
        this.refreshTimeModel = this.refreshTimeModel.bind(this);
        appEvents.subscribe(ZoomOutEvent, (e) => {
            this.zoomOut(e.payload.scale, e.payload.updateUrl);
        });
        appEvents.subscribe(ShiftTimeEvent, (e) => {
            this.shiftTime(e.payload.direction, e.payload.updateUrl);
        });
        appEvents.subscribe(AbsoluteTimeEvent, (e) => {
            this.makeAbsoluteTime(e.payload.updateUrl);
        });
        document.addEventListener('visibilitychange', () => {
            if (this.autoRefreshBlocked && document.visibilityState === 'visible') {
                this.autoRefreshBlocked = false;
                this.refreshTimeModel();
            }
        });
    }
    init(timeModel) {
        var _a, _b;
        this.timeModel = timeModel;
        this.time = timeModel.time;
        this.refresh = timeModel.refresh;
        this.initTimeFromUrl();
        this.parseTime();
        // remember time at load so we can go back to it
        this.timeAtLoad = cloneDeep(this.time);
        const range = rangeUtil.convertRawToRange(this.time, (_a = this.timeModel) === null || _a === void 0 ? void 0 : _a.getTimezone(), (_b = this.timeModel) === null || _b === void 0 ? void 0 : _b.fiscalYearStartMonth);
        if (range.to.isBefore(range.from)) {
            this.setTime({
                from: range.raw.to,
                to: range.raw.from,
            }, false);
        }
        if (this.refresh) {
            this.setAutoRefresh(this.refresh);
        }
    }
    getValidIntervals(intervals) {
        return this.contextSrv.getValidIntervals(intervals);
    }
    parseTime() {
        // when absolute time is saved in json it is turned to a string
        if (isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
            this.time.from = dateTime(this.time.from).utc();
        }
        if (isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
            this.time.to = dateTime(this.time.to).utc();
        }
    }
    parseUrlParam(value) {
        if (value.indexOf('now') !== -1) {
            return value;
        }
        if (value.length === 8) {
            const utcValue = toUtc(value, 'YYYYMMDD');
            if (utcValue.isValid()) {
                return utcValue;
            }
        }
        else if (value.length === 15) {
            const utcValue = toUtc(value, 'YYYYMMDDTHHmmss');
            if (utcValue.isValid()) {
                return utcValue;
            }
        }
        if (!isNaN(Number(value))) {
            const epoch = parseInt(value, 10);
            return toUtc(epoch);
        }
        return null;
    }
    getTimeWindow(time, timeWindow) {
        const valueTime = parseInt(time, 10);
        let timeWindowMs;
        if (timeWindow.match(/^\d+$/) && parseInt(timeWindow, 10)) {
            // when time window specified in ms
            timeWindowMs = parseInt(timeWindow, 10);
        }
        else {
            timeWindowMs = rangeUtil.intervalToMs(timeWindow);
        }
        return {
            from: toUtc(valueTime - timeWindowMs / 2),
            to: toUtc(valueTime + timeWindowMs / 2),
        };
    }
    initTimeFromUrl() {
        var _a, _b, _c, _d, _e, _f;
        if (config.publicDashboardAccessToken && ((_b = (_a = this.timeModel) === null || _a === void 0 ? void 0 : _a.timepicker) === null || _b === void 0 ? void 0 : _b.hidden)) {
            return;
        }
        const params = locationService.getSearch();
        if (params.get('time') && params.get('time.window')) {
            this.time = this.getTimeWindow(params.get('time'), params.get('time.window'));
        }
        if (params.get('from')) {
            this.time.from = this.parseUrlParam(params.get('from')) || this.time.from;
        }
        if (params.get('to')) {
            this.time.to = this.parseUrlParam(params.get('to')) || this.time.to;
        }
        // if absolute ignore refresh option saved to timeModel
        if (params.get('to') && params.get('to').indexOf('now') === -1) {
            this.refresh = false;
            if (this.timeModel) {
                this.timeModel.refresh = false;
            }
        }
        // but if refresh explicitly set then use that
        this.refresh = getRefreshFromUrl({
            urlRefresh: params.get('refresh'),
            currentRefresh: this.refresh,
            refreshIntervals: Array.isArray((_d = (_c = this.timeModel) === null || _c === void 0 ? void 0 : _c.timepicker) === null || _d === void 0 ? void 0 : _d.refresh_intervals)
                ? (_f = (_e = this.timeModel) === null || _e === void 0 ? void 0 : _e.timepicker) === null || _f === void 0 ? void 0 : _f.refresh_intervals
                : undefined,
            isAllowedIntervalFn: this.contextSrv.isAllowedInterval,
            minRefreshInterval: config.minRefreshInterval,
        });
    }
    updateTimeRangeFromUrl() {
        const params = locationService.getSearch();
        if (params.get('left')) {
            return; // explore handles this;
        }
        const urlRange = this.timeRangeForUrl();
        const from = params.get('from');
        const to = params.get('to');
        // check if url has time range
        if (from && to) {
            // is it different from what our current time range?
            if (from !== urlRange.from || to !== urlRange.to) {
                // issue update
                this.initTimeFromUrl();
                this.setTime(this.time, false);
            }
        }
        else if (this.timeHasChangedSinceLoad()) {
            this.setTime(this.timeAtLoad, true);
        }
    }
    timeHasChangedSinceLoad() {
        return this.timeAtLoad && (this.timeAtLoad.from !== this.time.from || this.timeAtLoad.to !== this.time.to);
    }
    setAutoRefresh(interval) {
        if (this.timeModel) {
            this.timeModel.refresh = interval;
        }
        this.stopAutoRefresh();
        const currentUrlState = locationService.getSearchObject();
        if (!interval) {
            // Clear URL state
            if (currentUrlState.refresh) {
                locationService.partial({ refresh: null }, true);
            }
            return;
        }
        let refresh = interval;
        let intervalMs = 60 * 1000;
        if (interval === AutoRefreshInterval) {
            intervalMs = this.getAutoRefreshInteval().intervalMs;
        }
        else {
            refresh = this.contextSrv.getValidInterval(interval);
            intervalMs = rangeUtil.intervalToMs(refresh);
        }
        this.refreshMS = intervalMs;
        this.refreshTimer = window.setTimeout(() => {
            this.startNextRefreshTimer(intervalMs);
            this.refreshTimeModel();
        }, intervalMs);
        if (currentUrlState.refresh !== refresh) {
            locationService.partial({ refresh }, true);
        }
    }
    getAutoRefreshInteval() {
        var _a;
        const resolution = (_a = window === null || window === void 0 ? void 0 : window.innerWidth) !== null && _a !== void 0 ? _a : 2000;
        return rangeUtil.calculateInterval(this.timeRange(), resolution, // the max pixels possibles
        config.minRefreshInterval);
    }
    refreshTimeModel() {
        var _a;
        (_a = this.timeModel) === null || _a === void 0 ? void 0 : _a.timeRangeUpdated(this.timeRange());
    }
    startNextRefreshTimer(afterMs) {
        this.refreshTimer = window.setTimeout(() => {
            this.startNextRefreshTimer(afterMs);
            if (this.contextSrv.isGrafanaVisible()) {
                this.refreshTimeModel();
            }
            else {
                this.autoRefreshBlocked = true;
            }
        }, afterMs);
    }
    stopAutoRefresh() {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
        this.refreshMS = undefined;
    }
    // resume auto-refresh based on old dashboard refresh property
    resumeAutoRefresh() {
        var _a;
        if ((_a = this.timeModel) === null || _a === void 0 ? void 0 : _a.refresh) {
            this.setAutoRefresh(this.timeModel.refresh);
        }
    }
    setTime(time, updateUrl = true) {
        var _a, _b, _c;
        extend(this.time, time);
        // disable refresh if zoom in or zoom out
        if (isDateTime(time.to)) {
            this.oldRefresh = ((_a = this.timeModel) === null || _a === void 0 ? void 0 : _a.refresh) || this.oldRefresh;
            this.setAutoRefresh(false);
        }
        else if (this.oldRefresh && this.oldRefresh !== ((_b = this.timeModel) === null || _b === void 0 ? void 0 : _b.refresh)) {
            this.setAutoRefresh(this.oldRefresh);
            this.oldRefresh = undefined;
        }
        if (updateUrl === true) {
            const urlRange = this.timeRangeForUrl();
            const urlParams = locationService.getSearchObject();
            if (urlParams.from === urlRange.from.toString() && urlParams.to === urlRange.to.toString()) {
                return;
            }
            urlParams.from = urlRange.from.toString();
            urlParams.to = urlRange.to.toString();
            locationService.partial(urlParams);
        }
        // Check if the auto refresh interval has changed
        if (((_c = this.timeModel) === null || _c === void 0 ? void 0 : _c.refresh) === AutoRefreshInterval) {
            const v = this.getAutoRefreshInteval().intervalMs;
            if (v !== this.refreshMS) {
                this.setAutoRefresh(AutoRefreshInterval);
            }
        }
        this.refreshTimeModel();
    }
    timeRange() {
        // Scenes can set this global object to the current time range.
        // This is a patch to support data sources that rely on TimeSrv.getTimeRange()
        if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
            return sceneGraph.getTimeRange(window.__grafanaSceneContext).state.value;
        }
        return getTimeRange(this.time, this.timeModel);
    }
    zoomOut(factor, updateUrl = true) {
        const range = this.timeRange();
        const { from, to } = getZoomedTimeRange(range, factor);
        this.setTime({ from: toUtc(from), to: toUtc(to) }, updateUrl);
    }
    shiftTime(direction, updateUrl = true) {
        const range = this.timeRange();
        const { from, to } = getShiftedTimeRange(direction, range);
        this.setTime({
            from: toUtc(from),
            to: toUtc(to),
        }, updateUrl);
    }
    makeAbsoluteTime(updateUrl) {
        const { from, to } = this.timeRange();
        this.setTime({ from, to }, updateUrl);
    }
    // isRefreshOutsideThreshold function calculates the difference between last refresh and now
    // if the difference is outside 5% of the current set time range then the function will return true
    // if the difference is within 5% of the current set time range then the function will return false
    // if the current time range is absolute (i.e. not using relative strings like now-5m) then the function will return false
    isRefreshOutsideThreshold(lastRefresh, threshold = 0.05) {
        const timeRange = this.timeRange();
        if (dateMath.isMathString(timeRange.raw.from)) {
            const totalRange = timeRange.to.diff(timeRange.from);
            const msSinceLastRefresh = Date.now() - lastRefresh;
            const msThreshold = totalRange * threshold;
            return msSinceLastRefresh >= msThreshold;
        }
        return false;
    }
}
let singleton;
export function setTimeSrv(srv) {
    singleton = srv;
}
export function getTimeSrv() {
    if (!singleton) {
        singleton = new TimeSrv(contextSrv);
    }
    return singleton;
}
//# sourceMappingURL=TimeSrv.js.map