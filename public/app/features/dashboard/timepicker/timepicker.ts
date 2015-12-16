///<reference path="../../../headers/common.d.ts" />
///<amd-dependency path="./input_date" name="inputDate" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import kbn = require('app/core/utils/kbn');

import * as dateMath from '../../../core/utils/datemath';
import * as rangeUtil from '../../../core/utils/rangeutil';

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

    this.timeSrv.setTime(this.timeRaw, true);
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
