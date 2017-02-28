define([
  'angular',
  'lodash',
  'slider',
],
function (angular, _, noUiSlider) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertAssociationCtrl', function($scope, $routeParams, $location, alertMgrSrv, alertSrv, $timeout, contextSrv) {
    var alertMetric = $routeParams.metric;
    var alertHost = $routeParams.host;
    var distance = $routeParams.distance;
    $scope.correlationThreshold = distance;
    $scope.yaxisNumber = 3;
    $scope.init = function() {
      alertMgrSrv.loadAssociatedMetrics(alertMetric, alertHost, distance).then(function onSuccess(response) {
        var correlationOfAlertMap = response.data;
        for (var host in correlationOfAlertMap) {
          //TODO only support one host
          var correlatedMetrics = correlationOfAlertMap[host];
          $scope.correlatedMetrics = correlatedMetrics;
        }
      }).finally(function() {
        if (!_.isEmpty($scope.correlatedMetrics)) {
          $scope.isAssociation = true;
          for (var m in $scope.correlatedMetrics) {
            if(_.isEqual(m, alertMetric)){
              delete $scope.correlatedMetrics[m];
            }
          }
        } else {
          $scope.isAssociation = false;
        }
        $scope.createAlertMetricsGraph(_.getMetricName(alertMetric), alertHost);
      });
    };

    $scope.getRowPanelMeta = function (hostTag, metric) {
      return {
        title: "test for anmoly",
        height: '300px',
        panels: [
          {
            title: metric,
            error: false,
            span: 12,
            editable: false,
            linewidth: 2,
            height: "500px",
            type: "graph",
            targets: [
              {
                aggregator: "avg",
                metric: metric,
                downsampleAggregator: "avg",
                downsampleInterval: "1m",
                tags: {host: hostTag}
              }
            ],
            'y-axis': false,
            legend: {
              alignAsTable: true,
              avg: true,
              min: true,
              max: true,
              current: true,
              total: true,
              show: true,
              values: true
            },
            grid: {
              leftLogBase: 1,
              leftMax: null,
              leftMin: null,
              rightLogBase: 1,
              rightMax: null,
              rightMin: null,
              threshold1: alertMgrSrv.currentCritialThreshold,
              threshold1Color: "rgba(216, 169, 27, 0.61)",
              threshold2: alertMgrSrv.currentWarningThreshold,
              threshold2Color: "rgba(251, 0, 0, 0.57)",
              thresholdLine: true
            }
          }
        ]
      };
    };

    $scope.createAlertMetricsGraph = function (metrics, host) {
      $scope.initDashboard({
        meta: {canStar: false, canShare: false, canEdit: false, canSave: false},
        dashboard: {
          system: contextSrv.system,
          title: "相关联指标",
          id: metrics,
          rows: [$scope.getRowPanelMeta(host, metrics)],
          time: {from: "now-2h", to: "now"}
        }
      }, $scope);
    };

    $scope.flushResult = function () {
      alertMgrSrv.loadAssociatedMetrics(alertMetric, alertHost, distance).then(function onSuccess(response) {
        if (!_.isEmpty(response.data)) {
          $scope.init();
        } else {
          $scope.appEvent('alert-warning', ['抱歉', '运算还在进行']);
        }
      });
    };

    $scope.createAssociatedMetricGraphPanel = function(associatedMetrics) {
      var hostTag = associatedMetrics.hosts[0] || "*";
      var rowMeta = $scope.getRowPanelMeta(hostTag, associatedMetrics.metric);

      $scope.host = alertHost;

      $scope.initDashboard({
        meta: { canStar: false, canShare: false, canEdit: false , canSave: false},
        dashboard: {
          system: contextSrv.system,
          title: "相关联指标",
          id: alertMetric,
          rows: [rowMeta],
          time: {from: "now-1d", to: "now"}
        }
      }, $scope);
      $timeout(function() {
        $scope.$broadcast('render');
      });
    };

    $scope.resetCorrelation = function() {
      $scope.correlationThreshold = 50; // reset the threshold to default value
      alertMgrSrv.resetCorrelation(alertMetric, alertHost, $scope.correlationBefore, $scope.correlationAfter).then(function onSuccess() {
        $location.path("alerts/association/" + alertMetric + "/" + alertHost + "/" + $scope.correlationThreshold);
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };
    $scope.addQuery = function(metricName) {
      var metricNameMap = $scope.correlatedMetrics;
      var flag = true;

      _.each($scope.dashboard.rows[0].panels[0].targets,function(target) {
        if(target.metric === _.getMetricName(metricName)){
          target.hide = !target.hide;
          flag = false;
        }
      });
      if(flag) {
        var target = {
          "aggregator":"avg",
          "currentTagKey":"",
          "currentTagValue":"",
          "downsampleAggregator":"avg",
          "downsampleInterval":"1m",
          "errors":{},
          "hide":false,
          "isCounter":false,
          "metric":_.getMetricName(metricName),
          "shouldComputeRate":false,
          "tags":{"host":metricNameMap[metricName][0]}
        };
        $scope.dashboard.rows[0].panels[0].targets.push(target);
        var seriesOverride = {
          "alias":_.getMetricName(metricName)+"{host"+"="+target.tags.host+"}",
          "yaxis": $scope.yaxisNumber++
        };
        $scope.dashboard.rows[0].panels[0].seriesOverrides.push(seriesOverride);
      }
      $scope.broadcastRefresh();
      $scope.dashboard.meta.canSave = false;
    };

    $scope.resetCorrelation = function () {
      $location.path("alerts/association/" + alertMetric + "/" + alertHost + "/" + Math.floor($scope.thresholdSlider.get()));
    };

    $scope.init();
  });

  angular.module('grafana.directives').directive('slider', function() {
    return {
      restrict: 'A',
      scope: false,
      link: function (scope, element) {
        noUiSlider.create(element[0], {
          start: scope.$parent.correlationThreshold,
          connect: [true, false],
          tooltips: true,
          step: 10,
          range: {
            'min': 10,
            'max': 500
          }
        });
        scope.$parent.thresholdSlider = element[0].noUiSlider;
      }
    };
  });
});
