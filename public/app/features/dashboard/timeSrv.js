define([
  'angular',
  'lodash',
  'config',
  'kbn',
  'moment',
  'app/core/utils/datemath'
], function (angular, _, config, kbn, moment, dateMath) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('timeSrv', function($rootScope, $timeout, $routeParams, timer) {
    var self = this;

    this.init = function(dashboard) {
      timer.cancel_all();

      this.dashboard = dashboard;
      this.time = dashboard.time;

      this._initTimeFromUrl();
      this._parseTime();

      if(this.dashboard.refresh) {
        this.set_interval(this.dashboard.refresh);
      }
    };

    this._parseTime = function() {
      // when absolute time is saved in json it is turned to a string
      if (_.isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
        this.time.from = moment(this.time.from);
      }
      if (_.isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
        this.time.to = moment(this.time.to);
      }
    };

    this._parseUrlParam = function(value) {
      if (value.indexOf('now') !== -1) {
        return value;
      }
      if (value.length === 8) {
        return moment.utc(value, 'YYYYMMDD');
      }
      if (value.length === 15) {
        return moment.utc(value, 'YYYYMMDDTHHmmss');
      }
      var epoch = parseInt(value);
      if (!_.isNaN(epoch)) {
        return moment(epoch);
      }

      return null;
    };

    this._initTimeFromUrl = function() {
      if ($routeParams.from) {
        this.time.from = this._parseUrlParam($routeParams.from) || this.time.from;
      }
      if ($routeParams.to) {
        this.time.to = this._parseUrlParam($routeParams.to) || this.time.to;
      }
    };

    this.set_interval = function (interval) {
      this.dashboard.refresh = interval;
      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        this.start_scheduled_refresh(_i);
      } else {
        this.cancel_scheduled_refresh();
      }
    };

    this.refreshDashboard = function() {
      $rootScope.$broadcast('refresh');
    };

    this.start_scheduled_refresh = function (after_ms) {
      self.cancel_scheduled_refresh();
      self.refresh_timer = timer.register($timeout(function () {
        self.start_scheduled_refresh(after_ms);
        self.refreshDashboard();
      }, after_ms));
    };

    this.cancel_scheduled_refresh = function () {
      timer.cancel(this.refresh_timer);
    };

    this.setTime = function(time) {
      _.extend(this.time, time);

      // disable refresh if we have an absolute time
      if (_.isString(time.to) && time.to.indexOf('now') === -1) {
        this.old_refresh = this.dashboard.refresh || this.old_refresh;
        this.set_interval(false);
      }
      else if (this.old_refresh && this.old_refresh !== this.dashboard.refresh) {
        this.set_interval(this.old_refresh);
        this.old_refresh = null;
      }

      $rootScope.appEvent('time-range-changed', this.time);
      $timeout(this.refreshDashboard, 0);
    };

    this.timeRangeForUrl = function() {
      var range = this.timeRange(false);
      if (_.isString(range.to) && range.to.indexOf('now')) {
        range = this.timeRange();
      }

      if (moment.isMoment(range.from)) { range.from = range.from.valueOf(); }
      if (moment.isMoment(range.to)) { range.to = range.to.valueOf(); }

      return range;
    };

    this.timeRange = function(parse) {
      var _t = this.time;

      if(parse === false) {
        return { from: _t.from, to: _t.to };
      } else {
        var _from = _t.from;
        var _to = _t.to || moment();

        return {
          from: dateMath.parse(_from, false),
          to: dateMath.parse(_to, true)
        };
      }
    };

  });

});
