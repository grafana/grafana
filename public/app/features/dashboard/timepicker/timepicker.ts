///<reference path="../../../headers/common.d.ts" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import kbn = require('kbn');
import dateMath = require('app/core/utils/datemath');
import rangeUtil = require('app/core/utils/rangeutil');

export class TimePickerCtrl {

  static defaults = {
    status        : "Stable",
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
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
    this.$scope.panel.now = false;

    _.defaults(this.$scope.panel, TimePickerCtrl.defaults);

    var time = this.timeSrv.timeRange();
    var timeRaw = this.timeSrv.timeRange(false);

    if (_.isString(timeRaw.to) && timeRaw.to.indexOf('now') === 0) {
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
      date: date,
      hour: this.pad(date.hours(), 2),
      minute: this.pad(date.minutes(), 2),
      second: this.pad(date.seconds(), 2),
      millisecond: this.pad(date.milliseconds(), 3)
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
        model.rangeString = rangeUtil.describeTimeRange(this.timeSrv.time);
      }
      else {
        model.rangeString = this.$scope.dashboard.formatDate(model.from.date, 'MMM D, YYYY HH:mm:ss') + ' to ' +
          this.$scope.dashboard.formatDate(model.to.date, 'MMM D, YYYY HH:mm:ss');
      }
    }

    return model;
  }

  loadTimeOptions() {
    this.$scope.timeOptions = rangeUtil.getRelativeTimesList(this.$scope.panel);
    this.$scope.refreshMenuLeftSide = this.$scope.time.rangeString.length < 10;
  }

  customTime() {
    // Assume the form is valid since we're setting it to something valid
    this.$scope.input.$setValidity("dummy", true);
    this.$scope.temptime = angular.copy(this.$scope.time);
    this.$scope.temptime.now = this.$scope.panel.now;

    // this.$scope.temptime.from.date.setHours(0, 0, 0, 0);
    // this.$scope.temptime.to.date.setHours(0, 0, 0, 0);

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

    this.$scope.time = this.getScopeTimeObj(dateMath.parse(range.from), moment());
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
  }

}

export function settingsDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/features/dashboard/timepicker/settings.html',
    controller: TimePickerCtrl,
    scope: true,
  };
}

export function timePickerDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/features/dashboard/timepicker/timepicker.html',
    controller: TimePickerCtrl,
    scope: true
  };
}


angular.module('grafana.directives').directive('gfTimePickerSettings', settingsDirective);
angular.module('grafana.directives').directive('gfTimePicker', timePickerDirective);
