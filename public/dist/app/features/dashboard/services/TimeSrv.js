// Libraries
import moment from 'moment';
import _ from 'lodash';
// Utils
import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';
import * as dateMath from 'app/core/utils/datemath';
var TimeSrv = /** @class */ (function () {
    /** @ngInject */
    function TimeSrv($rootScope, $timeout, $location, timer, contextSrv) {
        var _this = this;
        this.$timeout = $timeout;
        this.$location = $location;
        this.timer = timer;
        this.contextSrv = contextSrv;
        // default time
        this.time = { from: '6h', to: 'now' };
        $rootScope.$on('zoom-out', this.zoomOut.bind(this));
        $rootScope.$on('$routeUpdate', this.routeUpdated.bind(this));
        document.addEventListener('visibilitychange', function () {
            if (_this.autoRefreshBlocked && document.visibilityState === 'visible') {
                _this.autoRefreshBlocked = false;
                _this.refreshDashboard();
            }
        });
    }
    TimeSrv.prototype.init = function (dashboard) {
        this.timer.cancelAll();
        this.dashboard = dashboard;
        this.time = dashboard.time;
        this.refresh = dashboard.refresh;
        this.initTimeFromUrl();
        this.parseTime();
        // remember time at load so we can go back to it
        this.timeAtLoad = _.cloneDeep(this.time);
        if (this.refresh) {
            this.setAutoRefresh(this.refresh);
        }
    };
    TimeSrv.prototype.parseTime = function () {
        // when absolute time is saved in json it is turned to a string
        if (_.isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
            this.time.from = moment(this.time.from).utc();
        }
        if (_.isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
            this.time.to = moment(this.time.to).utc();
        }
    };
    TimeSrv.prototype.parseUrlParam = function (value) {
        if (value.indexOf('now') !== -1) {
            return value;
        }
        if (value.length === 8) {
            return moment.utc(value, 'YYYYMMDD');
        }
        if (value.length === 15) {
            return moment.utc(value, 'YYYYMMDDTHHmmss');
        }
        if (!isNaN(value)) {
            var epoch = parseInt(value, 10);
            return moment.utc(epoch);
        }
        return null;
    };
    TimeSrv.prototype.initTimeFromUrl = function () {
        var params = this.$location.search();
        if (params.from) {
            this.time.from = this.parseUrlParam(params.from) || this.time.from;
        }
        if (params.to) {
            this.time.to = this.parseUrlParam(params.to) || this.time.to;
        }
        // if absolute ignore refresh option saved to dashboard
        if (params.to && params.to.indexOf('now') === -1) {
            this.refresh = false;
            this.dashboard.refresh = false;
        }
        // but if refresh explicitly set then use that
        if (params.refresh) {
            this.refresh = params.refresh || this.refresh;
        }
    };
    TimeSrv.prototype.routeUpdated = function () {
        var params = this.$location.search();
        var urlRange = this.timeRangeForUrl();
        // check if url has time range
        if (params.from && params.to) {
            // is it different from what our current time range?
            if (params.from !== urlRange.from || params.to !== urlRange.to) {
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
        this.dashboard.refresh = interval;
        this.cancelNextRefresh();
        if (interval) {
            var intervalMs_1 = kbn.interval_to_ms(interval);
            this.refreshTimer = this.timer.register(this.$timeout(function () {
                _this.startNextRefreshTimer(intervalMs_1);
                _this.refreshDashboard();
            }, intervalMs_1));
        }
        // update url
        var params = this.$location.search();
        if (interval) {
            params.refresh = interval;
            this.$location.search(params);
        }
        else if (params.refresh) {
            delete params.refresh;
            this.$location.search(params);
        }
    };
    TimeSrv.prototype.refreshDashboard = function () {
        this.dashboard.timeRangeUpdated(this.timeRange());
    };
    TimeSrv.prototype.startNextRefreshTimer = function (afterMs) {
        var _this = this;
        this.cancelNextRefresh();
        this.refreshTimer = this.timer.register(this.$timeout(function () {
            _this.startNextRefreshTimer(afterMs);
            if (_this.contextSrv.isGrafanaVisible()) {
                _this.refreshDashboard();
            }
            else {
                _this.autoRefreshBlocked = true;
            }
        }, afterMs));
    };
    TimeSrv.prototype.cancelNextRefresh = function () {
        this.timer.cancel(this.refreshTimer);
    };
    TimeSrv.prototype.setTime = function (time, fromRouteUpdate) {
        _.extend(this.time, time);
        // disable refresh if zoom in or zoom out
        if (moment.isMoment(time.to)) {
            this.oldRefresh = this.dashboard.refresh || this.oldRefresh;
            this.setAutoRefresh(false);
        }
        else if (this.oldRefresh && this.oldRefresh !== this.dashboard.refresh) {
            this.setAutoRefresh(this.oldRefresh);
            this.oldRefresh = null;
        }
        // update url
        if (fromRouteUpdate !== true) {
            var urlRange = this.timeRangeForUrl();
            var urlParams = this.$location.search();
            urlParams.from = urlRange.from;
            urlParams.to = urlRange.to;
            this.$location.search(urlParams);
        }
        this.$timeout(this.refreshDashboard.bind(this), 0);
    };
    TimeSrv.prototype.timeRangeForUrl = function () {
        var range = this.timeRange().raw;
        if (moment.isMoment(range.from)) {
            range.from = range.from.valueOf().toString();
        }
        if (moment.isMoment(range.to)) {
            range.to = range.to.valueOf().toString();
        }
        return range;
    };
    TimeSrv.prototype.timeRange = function () {
        // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
        var raw = {
            from: moment.isMoment(this.time.from) ? moment(this.time.from) : this.time.from,
            to: moment.isMoment(this.time.to) ? moment(this.time.to) : this.time.to,
        };
        var timezone = this.dashboard && this.dashboard.getTimezone();
        return {
            from: dateMath.parse(raw.from, false, timezone),
            to: dateMath.parse(raw.to, true, timezone),
            raw: raw,
        };
    };
    TimeSrv.prototype.zoomOut = function (e, factor) {
        var range = this.timeRange();
        var timespan = range.to.valueOf() - range.from.valueOf();
        var center = range.to.valueOf() - timespan / 2;
        var to = center + (timespan * factor) / 2;
        var from = center - (timespan * factor) / 2;
        this.setTime({ from: moment.utc(from), to: moment.utc(to) });
    };
    return TimeSrv;
}());
export { TimeSrv };
var singleton;
export function setTimeSrv(srv) {
    singleton = srv;
}
export function getTimeSrv() {
    return singleton;
}
coreModule.service('timeSrv', TimeSrv);
//# sourceMappingURL=TimeSrv.js.map