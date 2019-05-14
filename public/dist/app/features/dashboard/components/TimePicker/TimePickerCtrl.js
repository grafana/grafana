import _ from 'lodash';
import angular from 'angular';
import moment from 'moment';
import * as rangeUtil from 'app/core/utils/rangeutil';
var TimePickerCtrl = /** @class */ (function () {
    /** @ngInject */
    function TimePickerCtrl($scope, $rootScope, timeSrv) {
        var _this = this;
        this.$scope = $scope;
        this.$rootScope = $rootScope;
        this.timeSrv = timeSrv;
        this.$scope.ctrl = this;
        $rootScope.onAppEvent('shift-time-forward', function () { return _this.move(1); }, $scope);
        $rootScope.onAppEvent('shift-time-backward', function () { return _this.move(-1); }, $scope);
        $rootScope.onAppEvent('closeTimepicker', this.openDropdown.bind(this), $scope);
        this.dashboard.on('refresh', this.onRefresh.bind(this), $scope);
        // init options
        this.panel = this.dashboard.timepicker;
        _.defaults(this.panel, TimePickerCtrl.defaults);
        this.firstDayOfWeek = moment.localeData().firstDayOfWeek();
        // init time stuff
        this.onRefresh();
    }
    TimePickerCtrl.prototype.onRefresh = function () {
        var time = angular.copy(this.timeSrv.timeRange());
        var timeRaw = angular.copy(time.raw);
        if (!this.dashboard.isTimezoneUtc()) {
            time.from.local();
            time.to.local();
            if (moment.isMoment(timeRaw.from)) {
                timeRaw.from.local();
            }
            if (moment.isMoment(timeRaw.to)) {
                timeRaw.to.local();
            }
            this.isUtc = false;
        }
        else {
            this.isUtc = true;
        }
        this.rangeString = rangeUtil.describeTimeRange(timeRaw);
        this.absolute = { fromJs: time.from.toDate(), toJs: time.to.toDate() };
        this.tooltip = this.dashboard.formatDate(time.from) + ' <br>to<br>';
        this.tooltip += this.dashboard.formatDate(time.to);
        this.timeRaw = timeRaw;
        this.isAbsolute = moment.isMoment(this.timeRaw.to);
    };
    TimePickerCtrl.prototype.zoom = function (factor) {
        this.$rootScope.appEvent('zoom-out', 2);
    };
    TimePickerCtrl.prototype.move = function (direction) {
        var range = this.timeSrv.timeRange();
        var timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
        var to, from;
        if (direction === -1) {
            to = range.to.valueOf() - timespan;
            from = range.from.valueOf() - timespan;
        }
        else if (direction === 1) {
            to = range.to.valueOf() + timespan;
            from = range.from.valueOf() + timespan;
            if (to > Date.now() && range.to < Date.now()) {
                to = Date.now();
                from = range.from.valueOf();
            }
        }
        else {
            to = range.to.valueOf();
            from = range.from.valueOf();
        }
        this.timeSrv.setTime({ from: moment.utc(from), to: moment.utc(to) });
    };
    TimePickerCtrl.prototype.openDropdown = function () {
        if (this.isOpen) {
            this.closeDropdown();
            return;
        }
        this.onRefresh();
        this.editTimeRaw = this.timeRaw;
        this.timeOptions = rangeUtil.getRelativeTimesList(this.panel, this.rangeString);
        this.refresh = {
            value: this.dashboard.refresh,
            options: _.map(this.panel.refresh_intervals, function (interval) {
                return { text: interval, value: interval };
            }),
        };
        this.refresh.options.unshift({ text: 'off' });
        this.isOpen = true;
        this.$rootScope.appEvent('timepickerOpen');
    };
    TimePickerCtrl.prototype.closeDropdown = function () {
        this.isOpen = false;
        this.$rootScope.appEvent('timepickerClosed');
    };
    TimePickerCtrl.prototype.applyCustom = function () {
        if (this.refresh.value !== this.dashboard.refresh) {
            this.timeSrv.setAutoRefresh(this.refresh.value);
        }
        this.timeSrv.setTime(this.editTimeRaw);
        this.closeDropdown();
    };
    TimePickerCtrl.prototype.absoluteFromChanged = function () {
        this.editTimeRaw.from = this.getAbsoluteMomentForTimezone(this.absolute.fromJs);
    };
    TimePickerCtrl.prototype.absoluteToChanged = function () {
        this.editTimeRaw.to = this.getAbsoluteMomentForTimezone(this.absolute.toJs);
    };
    TimePickerCtrl.prototype.getAbsoluteMomentForTimezone = function (jsDate) {
        return this.dashboard.isTimezoneUtc() ? moment(jsDate).utc() : moment(jsDate);
    };
    TimePickerCtrl.prototype.setRelativeFilter = function (timespan) {
        var range = { from: timespan.from, to: timespan.to };
        if (this.panel.nowDelay && range.to === 'now') {
            range.to = 'now-' + this.panel.nowDelay;
        }
        this.timeSrv.setTime(range);
        this.closeDropdown();
    };
    TimePickerCtrl.tooltipFormat = 'MMM D, YYYY HH:mm:ss';
    TimePickerCtrl.defaults = {
        time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
        refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
    };
    return TimePickerCtrl;
}());
export { TimePickerCtrl };
export function settingsDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/TimePicker/settings.html',
        controller: TimePickerCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dashboard: '=',
        },
    };
}
export function timePickerDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/TimePicker/template.html',
        controller: TimePickerCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            dashboard: '=',
        },
    };
}
angular.module('grafana.directives').directive('gfTimePickerSettings', settingsDirective);
angular.module('grafana.directives').directive('gfTimePicker', timePickerDirective);
import { inputDateDirective } from './validation';
angular.module('grafana.directives').directive('inputDatetime', inputDateDirective);
//# sourceMappingURL=TimePickerCtrl.js.map