define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');
    module.controller('AnomalyMetric', function ($scope, healthSrv, $routeParams, $timeout, contextSrv) {
        var clusterId = $routeParams.clusterId;
        var panelMeta = {
          title: '指标健康异常状况',
          type: 'graph',
          fill: 0,
          height: "250px",
          linewidth: 2,
          helpInfo: {
                info: true,
                title:'说明信息',
                context:
                  '<p>1. 红点标注的标识异常点,根据指标历史规律判断指标的值出现异常</p>' +
                  '<p>2. prediction.max 和prediction.min 是通过历史规律预测得到的指标上限和指标下限, 帮助您判断未来指标的走势和返回</p>',
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
              points: true,
              legend: false
            },
            {
              alias: "",
              color: "#DEDAF7",
              zindex: "-1",
              legend: false
            },
            {
              alias: "",
              color: "#DEDAF7",
              zindex: "-1",
              legend: false
            }
          ],
          legend: {
            avg: true,
            min: true,
            max: true,
            current: true,
            total: true,
            show: true,
            values: true
          }
        };
        $scope.init = function () {
          var anomalyList = healthSrv.anomalyMetricsData[clusterId];
          var panels = [];
          _.each(anomalyList.elements, function (element) {
            panels.push(setPanelMetaHost(_.cloneDeep(panelMeta), element.metric, element.host))
          });

          $scope.initDashboard({
            meta: {canStar: false, canShare: false, canEdit: true, canSave: false},
            dashboard: {
              system: contextSrv.system,
              title: "健康管理",
              sharedCrosshair: true,
              id: Math.random(),
              rows: [{
                title: "anomaly for metric",
                height: '250px',
                panels: panels
              }],
              time: {from: "now-1d", to: "now"}
            }
          }, $scope);
        };

        function setPanelMetaHost(panelDef, metric, hostname) {
          metric = _.getMetricName(metric);
          var alias = metric + ".anomaly{host=" + hostname + "}";
          var panel = panelDef;
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
          panel.seriesOverrides[1].fill  = 0;
          panel.seriesOverrides[1].linewidth  = 0;
          panel.seriesOverrides[2].alias = metric + ".prediction.max{host=" + hostname + "}";
          panel.seriesOverrides[2].fillBelowTo = metric + ".prediction.min{host=" + hostname + "}";
          panel.seriesOverrides[2].linewidth  = 0;
          panel.seriesOverrides[2].fill = 5;
          return panelDef;
        }

        $scope.init();
      }
    );
  });
