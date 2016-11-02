define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');
    var panelMeta = {
      title: "anomaly for metric",
      height: '300px',
      panels: [
        {
          title: '指标健康异常状况',
          type: 'graph',
          fill: 0,
          height: "500px",
          linewidth: 2,
          targets: [
            {
              aggregator: "avg",
              metric: "",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: {host: ""}
            },
            {
              aggregator: "avg",
              metric: "",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: {host: ""}
            },
            {
              aggregator: "avg",
              metric: "",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: {host: ""}
            },
            {
              aggregator: "avg",
              metric: "",
              downsampleAggregator: "avg",
              downsampleInterval: "15m",
              tags: {host: ""}
            },
          ],
          seriesOverrides: [
            {
              alias: "",
              color: "#BF1B00",
              lines: false,
              pointradius: 2,
              points: true
            }/*,
            {
              alias: "",
              color: "#FDFCFF",
              linewidth: "0",
              fill: "10",
              zindex: "-1"
            },
            {
              alias: "",
              color: "#008000",
              zindex: "-2",
              fill: "1",
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
          }
        }
      ]
    };

    module.controller('AnomalyMetric', function ($scope, healthSrv, $routeParams, $timeout, contextSrv) {
        var metricName = $routeParams.metric;

        $scope.init = function () {
          var anomalyList = healthSrv.anomalyMetricsData;
          var hostList = getHostList(anomalyList, metricName);
          $scope.anomalyList = anomalyList;

          _.each(anomalyList, function (host) {
            if (host.metric === metricName) {
              $scope.hosts = host.hostHealth;
            }
          });

          $scope.initDashboard({
            meta: {canStar: false, canShare: false, canEdit: true},
            dashboard: {
              system: contextSrv.system,
              title: "健康管理",
              id: metricName,
              rows: [setPanelMetaHost(panelMeta, metricName, hostList[0])],
              time: {from: "now-1d", to: "now"}
            }
          }, $scope);

          $timeout(function () {
            $scope.$broadcast('render');
          });
        };

        $scope.changeHost = function (host) {
          $scope.dashboard.rows = [setPanelMetaHost($scope.dashboard.rows[0], metricName, host)];
          $scope.dashboard.meta.canSave = false;
          $scope.broadcastRefresh();
        };

        function getHostList(anomalyList, metricName) {
          var hosts = [];
          _.each(anomalyList, function (metric) {
            if (metric.metric === metricName) {
              hosts = Object.keys(metric.hostHealth);
            }
          });
          return hosts;
        }

        function setPanelMetaHost(panelDef, metric, hostname) {
          metric = _.getMetricName(metric);
          var alias = metric + ".anomaly{host=" + hostname + "}";
          var panel = panelDef.panels[0];
          panel.title = metric + "指标异常情况";
          panel.targets[0].metric = metric;
          panel.targets[0].tags.host = hostname;
          panel.targets[1].metric = metric + ".anomaly";
          panel.targets[1].tags.host = hostname;
          panel.targets[2].metric = metric + ".prediction.min";
          panel.targets[2].tags.host = hostname;
          panel.targets[3].metric = metric + ".prediction.max";
          panel.targets[3].tags.host = hostname;

          panel.seriesOverrides[0].alias = alias;
          //panel.seriesOverrides[1].alias = metric + ".prediction.min{host=" + hostname + "}";
          //panel.seriesOverrides[2].alias = metric + ".prediction.max{host=" + hostname + "}";

          return panelMeta;
        }

        $scope.init();
      }
    );
  });
