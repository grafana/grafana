define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('DecomposeMetricCtrl', function ($scope, $timeout, contextSrv) {
      $scope.init = function () {
        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: true, canSave: false},
          dashboard: {
            title: "健康管理",
            id: window.decomposeTarget.metric,
            rows: [{
              title: "test for anmoly",
              panels: getDecomposeMetric(window.decomposeTarget),
            }],
            time: {from: "now-1d", to: "now+5h"}
          }
        }, $scope);

        $timeout(function () {
          $scope.$broadcast('render');
        });
      };

      function getDecomposeMetric(target) {
        var targetMetricName = target.metric;
        var tag = target.tags;
        var rows = [];
        var panelMeta = {
          title: targetMetricName,
          type: 'graph',
          linewidth: 2,
          fill: 0,
          height: "300px",
          lines: true,
          targets: [
            {
              aggregator: "avg",
              metric: targetMetricName,
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: tag
            },
            {
              aggregator: "avg",
              metric: targetMetricName+".prediction",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: tag
            }/*,
            {
              aggregator: "avg",
              metric: targetMetricName+".prediction.min",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: tag
            },
            {
              aggregator: "avg",
              metric: targetMetricName+".prediction.max",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: tag
            }*/
          ],
          seriesOverrides: [
            {
              alias: targetMetricName + ".prediction{host=" + tag.host + "}",
              color: "#F9D9F9",
              zindex: "-1"
            }/*,
            {
              alias: targetMetricName + ".prediction.min{host=" + tag.host + "}",
              color: "#FDFCFF",
              linewidth:"0",
              fill:"10",
              zindex: "-1"
            },
            {
              alias: targetMetricName + ".prediction.max{host=" + tag.host + "}",
              color: "#008000",
              zindex: "-2",
              fill:"2",
              linewidth: "0",
            }*/
          ],
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
          'x-axis': true,
          'y-axis': true
        };
        rows.push(panelMeta);

        _.each([".trend", ".seasonal", ".noise"], function (defString, index) {
          var panelMeta = {
            title: '',
            type: 'graph',
            fill: 1,
            span: 12,
            linewidth: 2,
            height: "300px",
            lines: true,
            targets: [
              {
                aggregator: "avg",
                metric: "",
                downsampleAggregator: "avg",
                downsampleInterval: "15m",
                tags: {host: ""}
              }
            ],
            seriesOverrides: [],
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
            'x-axis': true,
            'y-axis': true
          };
          panelMeta.id = index + 2;
          panelMeta.title = targetMetricName + defString;
          panelMeta.targets[0].metric = targetMetricName + defString;
          panelMeta.targets[0].tags = tag;
          rows.push(panelMeta);
        });
        return rows;
      }

      $scope.init();
    });
  });
