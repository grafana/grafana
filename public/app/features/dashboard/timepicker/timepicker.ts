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

    this.$scope.absoluteJs =  {form: time.from.toDate(), to: time.to.toDate()};
    this.$scope.timeRaw = timeRaw;
    this.$scope.tooltip = this.$scope.dashboard.formatDate(time.from) + ' <br>to<br>';
    this.$scope.tooltip += this.$scope.dashboard.formatDate(time.to);

    this.$scope.onAppEvent('zoom-out', function() {
      this.$scope.zoom(2);
    });
  }

  openDropdown() {
    this.$scope.timeOptions = rangeUtil.getRelativeTimesList(this.$scope.panel, this.$scope.rangeString);
    this.$scope.refresh = {
      value: this.$scope.dashboard.refresh,
      options: _.map(this.$scope.panel.refresh_intervals, (interval: any) => {
        return {text: interval, value: interval};
      })
    };

    this.$scope.refresh.options.unshift({text: 'off'});

    this.$scope.appEvent('show-dash-editor', {
      src: 'app/features/dashboard/timepicker/dropdown.html',
      scope: this.$scope,
      cssClass: 'gf-timepicker-dropdown',
    });
  }

  applyCustom() {
    console.log(this.$scope.refresh.value);
    if (this.$scope.refresh.value !== this.$scope.dashboard.refresh) {
      this.timeSrv.setAutoRefresh(this.$scope.refresh.value);
    }

    this.timeSrv.setTime(this.$scope.timeRaw);
    this.$scope.appEvent('hide-dash-editor');
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
