import { __assign } from "tslib";
import { cloneDeep, extend, isString } from 'lodash';
import { dateMath, dateTime, getDefaultTimeRange, isDateTime, rangeUtil, toUtc, } from '@grafana/data';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { config } from 'app/core/config';
import { getRefreshFromUrl } from '../utils/getRefreshFromUrl';
import { locationService } from '@grafana/runtime';
import { ShiftTimeEvent, ZoomOutEvent } from '../../../types/events';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from 'app/core/app_events';
var TimeSrv = /** @class */ (function () {
    function TimeSrv(contextSrv) {
        var _this = this;
        this.contextSrv = contextSrv;
        this.timeRangeForUrl = function () {
            var range = _this.timeRange().raw;
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
        this.refreshDashboard = this.refreshDashboard.bind(this);
        appEvents.subscribe(ZoomOutEvent, function (e) {
            _this.zoomOut(e.payload);
        });
        appEvents.subscribe(ShiftTimeEvent, function (e) {
            _this.shiftTime(e.payload);
        });
        document.addEventListener('visibilitychange', function () {
            if (_this.autoRefreshBlocked && document.visibilityState === 'visible') {
                _this.autoRefreshBlocked = false;
                _this.refreshDashboard();
            }
        });
    }
    TimeSrv.prototype.init = function (dashboard) {
        var _a, _b;
        this.dashboard = dashboard;
        this.time = dashboard.time;
        this.refresh = dashboard.refresh;
        this.initTimeFromUrl();
        this.parseTime();
        // remember time at load so we can go back to it
        this.timeAtLoad = cloneDeep(this.time);
        var range = rangeUtil.convertRawToRange(this.time, (_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.getTimezone(), (_b = this.dashboard) === null || _b === void 0 ? void 0 : _b.fiscalYearStartMonth);
        if (range.to.isBefore(range.from)) {
            this.setTime({
                from: range.raw.to,
                to: range.raw.from,
            }, false);
        }
        if (this.refresh) {
            this.setAutoRefresh(this.refresh);
        }
    };
    TimeSrv.prototype.getValidIntervals = function (intervals) {
        if (!this.contextSrv.minRefreshInterval) {
            return intervals;
        }
        return intervals.filter(function (str) { return str !== ''; }).filter(this.contextSrv.isAllowedInterval);
    };
    TimeSrv.prototype.parseTime = function () {
        // when absolute time is saved in json it is turned to a string
        if (isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
            this.time.from = dateTime(this.time.from).utc();
        }
        if (isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
            this.time.to = dateTime(this.time.to).utc();
        }
    };
    TimeSrv.prototype.parseUrlParam = function (value) {
        if (value.indexOf('now') !== -1) {
            return value;
        }
        if (value.length === 8) {
            var utcValue = toUtc(value, 'YYYYMMDD');
            if (utcValue.isValid()) {
                return utcValue;
            }
        }
        else if (value.length === 15) {
            var utcValue = toUtc(value, 'YYYYMMDDTHHmmss');
            if (utcValue.isValid()) {
                return utcValue;
            }
        }
        if (!isNaN(value)) {
            var epoch = parseInt(value, 10);
            return toUtc(epoch);
        }
        return null;
    };
    TimeSrv.prototype.getTimeWindow = function (time, timeWindow) {
        var valueTime = parseInt(time, 10);
        var timeWindowMs;
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
    };
    TimeSrv.prototype.initTimeFromUrl = function () {
        var _a, _b, _c, _d;
        var params = locationService.getSearch();
        if (params.get('time') && params.get('time.window')) {
            this.time = this.getTimeWindow(params.get('time'), params.get('time.window'));
        }
        if (params.get('from')) {
            this.time.from = this.parseUrlParam(params.get('from')) || this.time.from;
        }
        if (params.get('to')) {
            this.time.to = this.parseUrlParam(params.get('to')) || this.time.to;
        }
        // if absolute ignore refresh option saved to dashboard
        if (params.get('to') && params.get('to').indexOf('now') === -1) {
            this.refresh = false;
            if (this.dashboard) {
                this.dashboard.refresh = false;
            }
        }
        var paramsJSON = {};
        params.forEach(function (value, key) {
            paramsJSON[key] = value;
        });
        // but if refresh explicitly set then use that
        this.refresh = getRefreshFromUrl({
            params: paramsJSON,
            currentRefresh: this.refresh,
            refreshIntervals: Array.isArray((_b = (_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.timepicker) === null || _b === void 0 ? void 0 : _b.refresh_intervals)
                ? (_d = (_c = this.dashboard) === null || _c === void 0 ? void 0 : _c.timepicker) === null || _d === void 0 ? void 0 : _d.refresh_intervals
                : undefined,
            isAllowedIntervalFn: this.contextSrv.isAllowedInterval,
            minRefreshInterval: config.minRefreshInterval,
        });
    };
    TimeSrv.prototype.updateTimeRangeFromUrl = function () {
        var params = locationService.getSearch();
        if (params.get('left')) {
            return; // explore handles this;
        }
        var urlRange = this.timeRangeForUrl();
        var from = params.get('from');
        var to = params.get('to');
        // check if url has time range
        if (from && to) {
            // is it different from what our current time range?
            if (from !== urlRange.from || to !== urlRange.to) {
                // issue update
                this.initTimeFromUrl();
                this.setTime(this.time, true);
            }
        }
        else if (this.timeHasChangedSinceLoad()) {
            this.setTime(this.timeAtLoad, true);
        }
    };
    TimeSrv.prototype.timeHasChangedSinceLoad = function () {
        return this.timeAtLoad && (this.timeAtLoad.from !== this.time.from || this.timeAtLoad.to !== this.time.to);
    };
    TimeSrv.prototype.setAutoRefresh = function (interval) {
        var _this = this;
        if (this.dashboard) {
            this.dashboard.refresh = interval;
        }
        this.stopAutoRefresh();
        var currentUrlState = locationService.getSearchObject();
        if (!interval) {
            // Clear URL state
            if (currentUrlState.refresh) {
                locationService.partial({ refresh: null }, true);
            }
            return;
        }
        var validInterval = this.contextSrv.getValidInterval(interval);
        var intervalMs = rangeUtil.intervalToMs(validInterval);
        this.refreshTimer = setTimeout(function () {
            _this.startNextRefreshTimer(intervalMs);
            _this.refreshDashboard();
        }, intervalMs);
        var refresh = this.contextSrv.getValidInterval(interval);
        if (currentUrlState.refresh !== refresh) {
            locationService.partial({ refresh: refresh }, true);
        }
    };
    TimeSrv.prototype.refreshDashboard = function () {
        var _a;
        (_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.timeRangeUpdated(this.timeRange());
    };
    TimeSrv.prototype.startNextRefreshTimer = function (afterMs) {
        var _this = this;
        this.refreshTimer = setTimeout(function () {
            _this.startNextRefreshTimer(afterMs);
            if (_this.contextSrv.isGrafanaVisible()) {
                _this.refreshDashboard();
            }
            else {
                _this.autoRefreshBlocked = true;
            }
        }, afterMs);
    };
    TimeSrv.prototype.stopAutoRefresh = function () {
        clearTimeout(this.refreshTimer);
    };
    // store dashboard refresh value and pause auto-refresh in some places
    // i.e panel edit
    TimeSrv.prototype.pauseAutoRefresh = function () {
        var _a;
        this.previousAutoRefresh = (_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.refresh;
        this.setAutoRefresh('');
    };
    // resume auto-refresh based on old dashboard refresh property
    TimeSrv.prototype.resumeAutoRefresh = function () {
        this.setAutoRefresh(this.previousAutoRefresh);
    };
    TimeSrv.prototype.setTime = function (time, fromRouteUpdate) {
        var _a, _b;
        extend(this.time, time);
        // disable refresh if zoom in or zoom out
        if (isDateTime(time.to)) {
            this.oldRefresh = ((_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.refresh) || this.oldRefresh;
            this.setAutoRefresh(false);
        }
        else if (this.oldRefresh && this.oldRefresh !== ((_b = this.dashboard) === null || _b === void 0 ? void 0 : _b.refresh)) {
            this.setAutoRefresh(this.oldRefresh);
            this.oldRefresh = null;
        }
        // update url
        if (fromRouteUpdate !== true) {
            var urlRange = this.timeRangeForUrl();
            var urlParams = locationService.getSearch();
            var from = urlParams.get('from');
            var to = urlParams.get('to');
            if (from && to && from === urlRange.from.toString() && to === urlRange.to.toString()) {
                return;
            }
            urlParams.set('from', urlRange.from.toString());
            urlParams.set('to', urlRange.to.toString());
            locationService.push(__assign(__assign({}, locationService.getLocation()), { search: urlParams.toString() }));
        }
        this.refreshDashboard();
    };
    TimeSrv.prototype.timeRange = function () {
        var _a, _b;
        // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
        var raw = {
            from: isDateTime(this.time.from) ? dateTime(this.time.from) : this.time.from,
            to: isDateTime(this.time.to) ? dateTime(this.time.to) : this.time.to,
        };
        var timezone = this.dashboard ? this.dashboard.getTimezone() : undefined;
        return {
            from: dateMath.parse(raw.from, false, timezone, (_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.fiscalYearStartMonth),
            to: dateMath.parse(raw.to, true, timezone, (_b = this.dashboard) === null || _b === void 0 ? void 0 : _b.fiscalYearStartMonth),
            raw: raw,
        };
    };
    TimeSrv.prototype.zoomOut = function (factor) {
        var range = this.timeRange();
        var _a = getZoomedTimeRange(range, factor), from = _a.from, to = _a.to;
        this.setTime({ from: toUtc(from), to: toUtc(to) });
    };
    TimeSrv.prototype.shiftTime = function (direction) {
        var range = this.timeRange();
        var _a = getShiftedTimeRange(direction, range), from = _a.from, to = _a.to;
        this.setTime({
            from: toUtc(from),
            to: toUtc(to),
        });
    };
    return TimeSrv;
}());
export { TimeSrv };
var singleton;
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