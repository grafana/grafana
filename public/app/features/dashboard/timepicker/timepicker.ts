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

  constructor(private $scope, private $rootScope, private timeSrv) {
    $scope.ctrl = this;

    $rootScope.onAppEvent('refresh', () => this.init(), $scope);
    $rootScope.onAppEvent('zoom-out', () => this.zoomOut(), $scope);
    this.init();
  }

  init() {
    this.panel = this.dashboard.timepicker;
    this.panel.now = false;

    _.defaults(this.panel, TimePickerCtrl.defaults);

    var time = this.timeSrv.timeRange();
    var timeRaw = this.timeSrv.timeRange(false);

    if (_.isString(timeRaw.to) && timeRaw.to.indexOf('now') === 0) {
      this.panel.now = true;
      this.rangeString = rangeUtil.describeTimeRange(timeRaw);
    } else {
      this.rangeString = this.dashboard.formatDate(time.from, TimePickerCtrl.tooltipFormat) + ' to ' +
        this.dashboard.formatDate(time.to, TimePickerCtrl.tooltipFormat);
    }

    this.absolute = {fromJs: time.from.toDate(), toJs: time.to.toDate()};
    this.timeRaw = timeRaw;
    this.tooltip = this.dashboard.formatDate(time.from) + ' <br>to<br>';
    this.tooltip += this.dashboard.formatDate(time.to);
  }

  zoomOut() {
  }

  openDropdown() {
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
    this.timeRaw.from = moment(this.absolute.fromJs);
  }

  absoluteToChanged() {
    this.timeRaw.to = moment(this.absolute.toJs);
  }

  setRelativeFilter(timespan) {
    this.panel.now = true;

    var range = {from: timespan.from, to: timespan.to};

    if (this.panel.nowDelay) {
      range.to = 'now-' + this.panel.nowDelay;
    }

    this.timeSrv.setTime(range);
    this.$rootScope.appEvent('hide-dash-editor');
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
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    }
  };
}


angular.module('grafana.directives').directive('gfTimePickerSettings', settingsDirective);
angular.module('grafana.directives').directive('gfTimePicker', timePickerDirective);
