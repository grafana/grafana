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
          tooltip:{
            shared:true
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
          },
          grid: {},
          y_formats: [
            "short",
            "short"
          ]
        };
        $scope.toTop = false;
        $scope.init = function () {
          var panels = [];
          $scope.selections = [];
          $scope.anomalyList = healthSrv.anomalyMetricsData[clusterId].elements;

          panels.push(setPanelMetaHost(_.cloneDeep(panelMeta), $scope.anomalyList[0].metric, $scope.anomalyList[0].host));
          $scope.anomalyList[0].checked = true;
          $scope.selections.push(setMetricName(_.getMetricName($scope.anomalyList[0].metric), $scope.anomalyList[0].host));
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

        $scope.changeSelect = function (anomalyItem) {
          if(anomalyItem) {
            var metricName = setMetricName(_.getMetricName(anomalyItem.metric), anomalyItem.host);
            var index = $scope.selections.indexOf(metricName);
            if(index == -1){
              $scope.addPanel(anomalyItem);
            } else{
              $scope.selections.splice(index,1);
              $scope.removePanel(metricName);
            }
          } else {
            $scope.changeAll();
          }
          $timeout(function() {
            $scope.$broadcast('render');
          });
        };

        $scope.addPanel = function(anomalyItem) {
          var metricName = setMetricName(_.getMetricName(anomalyItem.metric), anomalyItem.host);
          $scope.selections.push(metricName);
          $scope.dashboard.addPanel(setPanelMetaHost(_.cloneDeep(panelMeta), anomalyItem.metric, anomalyItem.host), $scope.dashboard.rows[0]);
        }

        $scope.removePanel = function(metricName) {
          $scope.dashboard.rows[0].panels.forEach(function(panel, id) {
            if(panel.title.indexOf(metricName)==0){
              $scope.dashboard.rows[0].panels.splice(id,1);
              return;
            }
          });
        }

        $scope.removeAll = function() {
          $scope.selections= [];
          $scope.dashboard.rows[0].panels = [];
          for(var i in $scope.anomalyList) {
            $scope.anomalyList[i].checked = false;
          }
        }

        $scope.changeAll = function() {
          if($scope.anomalyList.length == $scope.selections.length) {
            $scope.removeAll();
          }else{
            $scope.removeAll();
            for(var i in $scope.anomalyList) {
              $scope.addPanel($scope.anomalyList[i]);
              $scope.anomalyList[i].checked = true;
            }
          }

        }

        $scope.deleteMetric = function(anomalyItem) {
          var metricName = setMetricName(_.getMetricName(anomalyItem.metric), anomalyItem.host);
          var index = _.findIndex($scope.anomalyList,{'metric': anomalyItem.metric});
          $scope.anomalyList.splice(index,1);
          var id = $scope.selections.indexOf(metricName);
          if(id != -1) {
            $scope.removePanel(metricName);
            $scope.selections.splice(id,1);
          }
        }

        function setMetricName(metric, hostname) {
          return metric + "{host=" + hostname + "}";
        }

        function setPanelMetaHost(panelDef, metric, hostname) {
          metric = _.getMetricName(metric);
          var alias = metric + ".anomaly{host=" + hostname + "}";
          var panel = panelDef;
          panel.title = setMetricName(metric,hostname) + "指标异常情况";
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

          return panelDef;
        }

        $scope.init();

        $(window).scroll(function (event) {
          if(window.scrollY>=60){
            $scope.$apply(function() {
              $scope.toTop = true;
            });
            $('.table-container').width($('.main-view-container').width()-10);
          }else{
            $scope.$apply(function() {
              $scope.toTop = false;
            });
          }
        });
      }
    );
  });
