define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');
    module.controller('AnomalyMetric', function ($scope, healthSrv, $routeParams, $timeout, contextSrv) {
        var metricName = $routeParams.metric;
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
              helpInfo: {
                info: true,
                title:'说明信息',
                context: [
                  '1. 红点标注的标识异常点,根据指标历史规律判断指标的值出现异常',
                  '2. prediction.max 和prediction.min 是通过历史规律预测得到的指标上限和指标下限, 帮助您判断未来指标的走势和返回',
                ]
              },
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
                  pointradius: 3,
                  points: true
                },
                {
                  alias: "",
                  color: "#E5AC0E",
                  zindex: "-1"
                },
                {
                  alias: "",
                  color: "#BF1B00",
                  zindex: "-1"
                }
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
            meta: {canStar: false, canShare: false, canEdit: true, canSave: false},
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
          panel.seriesOverrides[1].alias = metric + ".prediction.min{host=" + hostname + "}";
          panel.seriesOverrides[2].alias = metric + ".prediction.max{host=" + hostname + "}";

          return panelMeta;
        }

        $scope.init();
      }
    );
  });
