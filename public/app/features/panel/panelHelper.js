define([
  'angular',
  'lodash',
  'kbn',
  'jquery',
],
function (angular, _, kbn, $) {
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

    this.broadcastRender = function(scope, data) {
      this.setTimeRenderStart(scope);
      scope.$broadcast('render', data);
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
      scope.rangeUnparsed = timeSrv.timeRange(false);
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
        if (!kbn.isValidTimeSpan(scope.panel.timeFrom)) {
          scope.panelMeta.timeInfo = 'invalid time override';
          return;
        }

        if (_.isString(scope.rangeUnparsed.from)) {
          scope.panelMeta.timeInfo = "last " + scope.panel.timeFrom;
          scope.rangeUnparsed.from = 'now-' + scope.panel.timeFrom;
          scope.range.from = kbn.parseDate(scope.rangeUnparsed.from);
        }
      }

      if (scope.panel.timeShift) {
        if (!kbn.isValidTimeSpan(scope.panel.timeShift)) {
          scope.panelMeta.timeInfo = 'invalid timeshift';
          return;
        }

        var timeShift = '-' + scope.panel.timeShift;
        scope.panelMeta.timeInfo += ' timeshift ' + timeShift;
        scope.range.from = kbn.parseDateMath(timeShift, scope.range.from);
        scope.range.to = kbn.parseDateMath(timeShift, scope.range.to);

        scope.rangeUnparsed = scope.range;
      }

      if (scope.panel.hideTimeOverride) {
        scope.panelMeta.timeInfo = '';
      }
    };

    this.issueMetricQuery = function(scope, datasource) {
      var metricsQuery = {
        range: scope.rangeUnparsed,
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
