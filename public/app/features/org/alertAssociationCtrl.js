define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertAssociationCtrl', function($scope, $routeParams, $location, alertMgrSrv, alertSrv, $timeout, contextSrv) {
    var associatedMetricRows = [];
    var alertMetric = $routeParams.metric;
    var alertHost = $routeParams.host;
    var distance = $routeParams.distance;
    $scope.yaxisNumber = 3;
    $scope.init = function() {
      alertMgrSrv.loadAssociatedMetrics(alertMetric, alertHost, distance).then(function onSuccess(response) {
        var correlationOfAlertMap = response.data;
        for (var host in correlationOfAlertMap) {
          var correlatedMetrics = correlationOfAlertMap[host];
          var normalizedMetricMap = {};
          $scope.correlatedMetrics = correlatedMetrics;
          for (var m in correlatedMetrics) {
            if (m in normalizedMetricMap) {
              normalizedMetricMap[m].push(
                {
                  metric: _.getMetricName(m),
                  hosts: correlatedMetrics[m]
                });
            } else {
              normalizedMetricMap[m] = [
                {
                  metric: _.getMetricName(m),
                  hosts: correlatedMetrics[m]
                }];
            }
          }
          for (var metric in normalizedMetricMap) {
            var oneRow = {};
            oneRow.height = '250px';
            oneRow.panels = [];
            oneRow.associatedMetrics = normalizedMetricMap[metric];
            associatedMetricRows.push(oneRow);
          }
        }
      }).then(function() {
        $scope.createAssociatedMetricGraphPanel(associatedMetricRows[0].associatedMetrics[0]);
      });
    };

    $scope.createAssociatedMetricGraphPanel = function(associatedMetrics) {
      var hostTag = associatedMetrics.hosts[0] || "*";
      var title = associatedMetrics.metric || "can no found any metric";

      var rowMeta = {
        title: "test for anmoly",
        height: '300px',
        panels: [
          {
            title: title,
            error: false,
            span: 12,
            editable: false,
            linewidth: 2,
            height: "500px",
            type: "graph",
            targets: [
              {
                aggregator: "avg",
                metric: associatedMetrics.metric,
                downsampleAggregator: "avg",
                downsampleInterval: "1m",
                tags: {host: hostTag}
              }
            ],
            'y-axis': false,
            legend:{
              alignAsTable: true,
              avg: true,
              min: true,
              max: true,
              current:true,
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

      $scope.host = alertHost;

      $scope.initDashboard({
        meta: { canStar: false, canShare: false, canEdit: false },
        dashboard: {
          system: contextSrv.system,
          title: "相关联指标",
          id: alertMetric,
          rows: [rowMeta],
          time: {from: "now-2h", to: "now"}
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
          "alias":metricName+"{host"+"="+target.tags.host+"}",
          "yaxis": $scope.yaxisNumber++
        };
        $scope.dashboard.rows[0].panels[0].seriesOverrides.push(seriesOverride);
      }
      $scope.broadcastRefresh();
      $scope.dashboard.meta.canSave = false;
    };

    $scope.init();
  });
});
