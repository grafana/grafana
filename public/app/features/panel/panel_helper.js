define([
  'angular',
  'lodash',
  'jquery',
  'app/core/utils/kbn',
  'app/core/utils/datemath',
  'app/core/utils/rangeutil',
],
function (angular, _, $, kbn, dateMath, rangeUtil) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('panelHelper', function(timeSrv, $rootScope) {
    var self = this;

    this.setTimeQueryStart = function(scope) {
      scope.timing = {};
      scope.timing.queryStart = new Date().getTime();
    };

    this.setTimeQueryEnd = function(scope) {
      scope.timing.queryEnd = new Date().getTime();
    };

    this.setTimeRenderStart = function(scope) {
      scope.timing = scope.timing || {};
      scope.timing.renderStart = new Date().getTime();
    };

    this.setTimeRenderEnd = function(scope) {
      scope.timing.renderEnd = new Date().getTime();
    };

    this.broadcastRender = function(scope, arg1, arg2) {
      this.setTimeRenderStart(scope);
      scope.$broadcast('render', arg1, arg2);
      this.setTimeRenderEnd(scope);

      if ($rootScope.profilingEnabled) {
        $rootScope.performance.panels.push({
          panelId: scope.panel.id,
          query: scope.timing.queryEnd - scope.timing.queryStart,
          render: scope.timing.renderEnd - scope.timing.renderStart,
        });
      }
    };

    this.updateTimeRange = function(scope) {
      scope.range = timeSrv.timeRange();
      scope.rangeRaw = timeSrv.timeRange(false);

      this.applyPanelTimeOverrides(scope);

      if (scope.panel.maxDataPoints) {
        scope.resolution = scope.panel.maxDataPoints;
      }
      else {
        scope.resolution = Math.ceil($(window).width() * (scope.panel.span / 12));
      }

      scope.interval = kbn.calculateInterval(scope.range, scope.resolution, scope.panel.interval);
    };

    this.applyPanelTimeOverrides = function(scope) {
      scope.panelMeta.timeInfo = '';

      // check panel time overrrides
      if (scope.panel.timeFrom) {
        var timeFromInfo = rangeUtil.describeTextRange(scope.panel.timeFrom);
        if (timeFromInfo.invalid) {
          scope.panelMeta.timeFromInfo = 'invalid time override';
          return;
        }

        if (_.isString(scope.rangeRaw.from)) {
          var timeFromDate = dateMath.parse(timeFromInfo.from);
          scope.panelMeta.timeInfo = timeFromInfo.display;
          scope.rangeRaw.from = timeFromInfo.from;
          scope.rangeRaw.to = timeFromInfo.to;
          scope.range.from = timeFromDate;
        }
      }

      if (scope.panel.timeShift) {
        var timeShiftInfo = rangeUtil.describeTextRange(scope.panel.timeShift);
        if (timeShiftInfo.invalid) {
          scope.panelMeta.timeInfo = 'invalid timeshift';
          return;
        }

        var timeShift = '-' + scope.panel.timeShift;
        scope.panelMeta.timeInfo += ' timeshift ' + timeShift;
        scope.range.from = dateMath.parseDateMath(timeShift, scope.range.from, false);
        scope.range.to = dateMath.parseDateMath(timeShift, scope.range.to, true);

        scope.rangeRaw = scope.range;
      }

      if (scope.panel.hideTimeOverride) {
        scope.panelMeta.timeInfo = '';
      }
    };

    this.issueMetricQuery = function(scope, datasource) {
      var metricsQuery = {
        range: scope.range,
        rangeRaw: scope.rangeRaw,
        interval: scope.interval,
        targets: scope.panel.targets,
        format: scope.panel.renderer === 'png' ? 'png' : 'json',
        maxDataPoints: scope.resolution,
        scopedVars: scope.panel.scopedVars,
        cacheTimeout: scope.panel.cacheTimeout
      };

      this.setTimeQueryStart(scope);
      return datasource.query(metricsQuery).then(function(results) {
        self.setTimeQueryEnd(scope);

        if (scope.dashboard.snapshot) {
          scope.panel.snapshotData = results;
        }

        return results;
      });
    };
  });
});
