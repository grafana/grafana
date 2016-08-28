define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('DecomposeMetricCtrl', function ($scope, $timeout) {
      $scope.init = function () {
        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: true},
          dashboard: {
            title: "健康管理",
            id: window.decomposeTarget.metric,
            rows: [{
              title: "test for anmoly",
              panels: getDecomposeMetric(window.decomposeTarget),
            }],
            time: {from: "now-1d", to: "now"}
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
                downsampleInterval: "1m",
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
