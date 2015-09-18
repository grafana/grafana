///<reference path="../../../headers/common.d.ts" />
///<amd-dependency path="./input_date" name="inputDate" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import kbn = require('kbn');
import dateMath = require('app/core/utils/datemath');
import rangeUtil = require('app/core/utils/rangeutil');

declare var inputDate: any;

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
      this.$scope.rangeString = rangeUtil.describeTimeRange(timeRaw);
    } else {
      let format =  'MMM D, YYYY HH:mm:ss';
      this.$scope.rangeString = this.$scope.dashboard.formatDate(time.from, format) + ' to ' +
        this.$scope.dashboard.formatDate(time.to, format);
    }

    this.$scope.absolute =  {form: time.from.toDate(), to: time.to.toDate()};
    this.$scope.timeRaw = timeRaw;
    this.$scope.tooltip = this.$scope.dashboard.formatDate(time.from) + ' <br>to<br>';
    this.$scope.tooltip += this.$scope.dashboard.formatDate(time.to);

    this.$scope.onAppEvent('zoom-out', function() {
      this.$scope.zoom(2);
    });
  }

  openDropdown() {
    this.$scope.timeOptions = rangeUtil.getRelativeTimesList(this.$scope.panel, this.$scope.rangeString);
    this.$scope.currentRefresh = this.$scope.dashboard.refresh || 'off';
    this.$scope.refreshOptions = this.$scope.panel.refresh_intervals;
    this.$scope.refreshOptions.unshift('off');

    this.$scope.appEvent('show-dash-editor', {
      src: 'app/features/dashboard/timepicker/dropdown.html',
      scope: this.$scope,
      cssClass: 'gf-timepicker-dropdown',
    });
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

  setAbsoluteTimeFilter(time) {
    // Create filter object
    var _filter = _.clone(time);

    if (time.now) {
      _filter.to = "now";
    }

    this.timeSrv.setTime(_filter);
  }

  setRelativeFilter(timespan) {
    this.$scope.panel.now = true;

    var range = {from: timespan.from, to: timespan.to};

    if (this.$scope.panel.nowDelay) {
      range.to = 'now-' + this.$scope.panel.nowDelay;
    }

    this.timeSrv.setTime(range);
    this.$scope.appEvent('hide-dash-editor');
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
