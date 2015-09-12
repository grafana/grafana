///<reference path="../../../headers/common.d.ts" />
///<amd-dependency path="./input_date" name="inputDate" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import kbn = require('kbn');
import dateMath = require('app/core/utils/datemath');
import rangeUtil = require('app/core/utils/rangeutil');

<<<<<<< 6e6200173affee36da5b148c4da2e935e892fb9e
declare var inputDate: any;

export class TimePickerCtrl {

  static tooltipFormat = 'MMM D, YYYY HH:mm:ss';
  static defaults = {
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    refresh_intervals : ['5s','10s','30s','1m','5m','15m','30m','1h','2h','1d'],
  };

  dashboard: any;
  panel: any;
  absolute: any;
  timeRaw: any;
  tooltip: string;
  rangeString: string;
  timeOptions: any;
  refresh: any;
  isOpen: boolean;
  isUtc: boolean;

  constructor(private $scope, private $rootScope, private timeSrv) {
    $scope.ctrl = this;

    $rootScope.onAppEvent('zoom-out', () => this.zoom(2), $scope);
    $rootScope.onAppEvent('refresh', () => this.init(), $scope);
    $rootScope.onAppEvent('dash-editor-hidden', () => this.isOpen = false, $scope);

    this.init();
  }

  init() {
    this.panel = this.dashboard.timepicker;

    _.defaults(this.panel, TimePickerCtrl.defaults);

    var time = angular.copy(this.timeSrv.timeRange());
    var timeRaw = angular.copy(this.timeSrv.timeRange(false));

    if (this.dashboard.timezone === 'browser') {
      time.from.local();
      time.to.local();
      if (moment.isMoment(timeRaw.from)) {
        timeRaw.from.local();
      }
      if (moment.isMoment(timeRaw.to)) {
        timeRaw.to.local();
      }
    } else {
      this.isUtc = true;
    }

    this.rangeString = rangeUtil.describeTimeRange(timeRaw);
    this.absolute = {fromJs: time.from.toDate(), toJs: time.to.toDate()};
    this.tooltip = this.dashboard.formatDate(time.from) + ' <br>to<br>';
    this.tooltip += this.dashboard.formatDate(time.to);

    // do not update time raw when dropdown is open
    // as auto refresh will reset the from/to input fields
    if (!this.isOpen) {
      this.timeRaw = timeRaw;
    }
  }

  zoom(factor) {
    var range = this.timeSrv.timeRange();

    var timespan = (range.to.valueOf() - range.from.valueOf());
    var center = range.to.valueOf() - timespan/2;

    var to = (center + (timespan*factor)/2);
    var from = (center - (timespan*factor)/2);

    if (to > Date.now() && range.to <= Date.now()) {
      var offset = to - Date.now();
      from = from - offset;
      to = Date.now();
    }

    this.timeSrv.setTime({from: moment.utc(from), to: moment.utc(to) });
  }

  openDropdown() {
    this.init();
    this.isOpen = true;
    this.timeOptions = rangeUtil.getRelativeTimesList(this.panel, this.rangeString);
    this.refresh = {
      value: this.dashboard.refresh,
      options: _.map(this.panel.refresh_intervals, (interval: any) => {
        return {text: interval, value: interval};
      })
    };

    this.refresh.options.unshift({text: 'off'});

    this.$rootScope.appEvent('show-dash-editor', {
      src: 'app/features/dashboard/timepicker/dropdown.html',
      scope: this.$scope,
      cssClass: 'gf-timepicker-dropdown',
    });
  }

  applyCustom() {
    if (this.refresh.value !== this.dashboard.refresh) {
      this.timeSrv.setAutoRefresh(this.refresh.value);
    }

    this.timeSrv.setTime(this.timeRaw);
    this.$rootScope.appEvent('hide-dash-editor');
  }

  absoluteFromChanged() {
    this.timeRaw.from = this.getAbsoluteMomentForTimezone(this.absolute.fromJs);
  }

  absoluteToChanged() {
    this.timeRaw.to = this.getAbsoluteMomentForTimezone(this.absolute.toJs);
  }

  getAbsoluteMomentForTimezone(jsDate) {
    return this.dashboard.timezone === 'browser' ? moment(jsDate) : moment(jsDate).utc();
  }

  setRelativeFilter(timespan) {
    this.panel.now = true;

    var range = {from: timespan.from, to: timespan.to};

    if (this.panel.nowDelay && range.to === 'now') {
      range.to = 'now-' + this.panel.nowDelay;
    }

    this.timeSrv.setTime(range);
    this.$rootScope.appEvent('hide-dash-editor');
=======
export class TimePickerCtrl {

  static defaults = {
    status        : "Stable",
    time_options  : ['5m','15m','1h','6h','12h','24h','today', '2d','7d','30d'],
    refresh_intervals : ['5s','10s','30s','1m','5m','15m','30m','1h','2h','1d'],
  };

  static patterns = {
      date: /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/,
      hour: /^([01]?[0-9]|2[0-3])$/,
      minute: /^[0-5][0-9]$/,
      second: /^[0-5][0-9]$/,
      millisecond: /^[0-9]*$/
  };

  constructor(private $scope : any, private $rootScope, private timeSrv) {
    $scope.patterns = TimePickerCtrl.patterns;
    $scope.timeSrv = timeSrv;
    $scope.ctrl = this;

    $scope.$on('refresh', () => this.init());

    this.init();
  }

  init() {
    this.$scope.panel = this.$scope.dashboard.timepicker;

    _.defaults(this.$scope.panel, TimePickerCtrl.defaults);

    var time = this.timeSrv.timeRange(true);
    this.$scope.panel.now = false;

    var unparsed = this.timeSrv.timeRange(false);
    if (_.isString(unparsed.to) && unparsed.to.indexOf('now') === 0) {
      this.$scope.panel.now = true;
    }

    this.$scope.time = this.getScopeTimeObj(time.from, time.to);

    this.$scope.onAppEvent('zoom-out', function() {
      this.$scope.zoom(2);
    });
  }

  pad(n: number, width: number, z = 0): string {
    var str = n.toString();
    return str.length >= width ? str : new Array(width - str.length + 1).join(z.toString()) + str;
  }

  getTimeObj(date): any {
    return {
      date: new Date(date),
      hour: this.pad(date.getHours(), 2),
      minute: this.pad(date.getMinutes(), 2),
      second: this.pad(date.getSeconds(), 2),
      millisecond: this.pad(date.getMilliseconds(), 3)
    };
  };

  getScopeTimeObj(from, to) {
    var model : any = {from: this.getTimeObj(from), to: this.getTimeObj(to)};

    if (model.from.date) {
      model.tooltip = this.$scope.dashboard.formatDate(model.from.date) + ' <br>to<br>';
      model.tooltip += this.$scope.dashboard.formatDate(model.to.date);
    }
    else {
      model.tooltip = 'Click to set time filter';
    }

    if (this.timeSrv.time) {
      if (this.$scope.panel.now) {
        if (this.timeSrv.time.from === 'today') {
          model.rangeString = 'Today';
        } else {
          model.rangeString = moment(model.from.date).fromNow() + ' to ' +
            moment(model.to.date).fromNow();
        }
      }
      else {
        model.rangeString = this.$scope.dashboard.formatDate(model.from.date, 'MMM D, YYYY HH:mm:ss') + ' to ' +
          this.$scope.dashboard.formatDate(model.to.date, 'MMM D, YYYY HH:mm:ss');
      }
    }

    return model;
  }

  loadTimeOptions() {
    this.$scope.time_options = _.map(this.$scope.panel.time_options, function(str) {
      return kbn.getRelativeTimeInfo(str);
    });

    this.$scope.refreshMenuLeftSide = this.$scope.time.rangeString.length < 10;
  }

  cloneTime(time) {
    var _n = { from: _.clone(time.from), to: _.clone(time.to) };

    // Create new dates as _.clone is shallow.
    _n.from.date = new Date(_n.from.date);
    _n.to.date = new Date(_n.to.date);
    return _n;
  }

  customTime() {
    // Assume the form is valid since we're setting it to something valid
    this.$scope.input.$setValidity("dummy", true);
    this.$scope.temptime = this.cloneTime(this.$scope.time);
    this.$scope.temptime.now = this.$scope.panel.now;

    this.$scope.temptime.from.date.setHours(0, 0, 0, 0);
    this.$scope.temptime.to.date.setHours(0, 0, 0, 0);

    // Date picker needs the date to be at the start of the day
    if (new Date().getTimezoneOffset() < 0) {
      this.$scope.temptime.from.date = moment(this.$scope.temptime.from.date).add(1, 'days').toDate();
      this.$scope.temptime.to.date = moment(this.$scope.temptime.to.date).add(1, 'days').toDate();
    }

    this.$scope.appEvent('show-dash-editor', {
      src: 'app/features/dashboard/timepicker/custom.html',
      scope: this.$scope
    });
  }

  setNow() {
    this.$scope.time.to = this.getTimeObj(new Date());
  }

  setAbsoluteTimeFilter(time) {
    // Create filter object
    var _filter = _.clone(time);

    if (time.now) {
      _filter.to = "now";
    }

    // Update our representation
    this.$scope.time = this.getScopeTimeObj(time.from, time.to);
    this.timeSrv.setTime(_filter);
  }

  setRelativeFilter(timespan) {
    this.$scope.panel.now = true;

    var range = {from: timespan.from, to: timespan.to};

    if (this.$scope.panel.nowDelay) {
      range.to = 'now-' + this.$scope.panel.nowDelay;
    }

    this.timeSrv.setTime(range);

    this.$scope.time = this.getScopeTimeObj(kbn.parseDate(range.from), new Date());
  }

  validate(time): any {
    // Assume the form is valid. There is a hidden dummy input for invalidating it programatically.
    this.$scope.input.$setValidity("dummy", true);

    var _from = this.datepickerToLocal(time.from.date);
    var _to = this.datepickerToLocal(time.to.date);
    var _t = time;

    if (this.$scope.input.$valid) {
      _from.setHours(_t.from.hour, _t.from.minute, _t.from.second, _t.from.millisecond);
      _to.setHours(_t.to.hour, _t.to.minute, _t.to.second, _t.to.millisecond);

      // Check that the objects are valid and to is after from
      if (isNaN(_from.getTime()) || isNaN(_to.getTime()) || _from.getTime() >= _to.getTime()) {
        this.$scope.input.$setValidity("dummy", false);
        return false;
      }
    } else {
      return false;
    }

    return { from: _from, to: _to, now: time.now };
  }

  datepickerToLocal(date) {
    date = moment(date).clone().toDate();
    return moment(new Date(date.getTime() + date.getTimezoneOffset() * 60000)).toDate();
>>>>>>> refactor: finished timepicker to typescript and directive refactor
  }

}

export function settingsDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/features/dashboard/timepicker/settings.html',
    controller: TimePickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    }
  };
}

export function timePickerDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/features/dashboard/timepicker/timepicker.html',
    controller: TimePickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    }
  };
}


angular.module('grafana.directives').directive('gfTimePickerSettings', settingsDirective);
angular.module('grafana.directives').directive('gfTimePicker', timePickerDirective);
