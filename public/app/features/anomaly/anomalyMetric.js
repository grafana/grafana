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
          },
          grid: {},
          y_formats: [
            "short",
            "short"
          ]
        };
        var selectNum = 1;
        $scope.toTop = false;
        $scope.init = function () {
          var anomalyList = healthSrv.anomalyMetricsData[clusterId];
          var panels = [];
          $scope.metrics = anomalyList.elements;
          $scope.selections = [];
          $scope.selectAll = false;
          _.each(anomalyList.elements, function (element) {
            $scope.selections.push(false);
          });

          panels.push(setPanelMetaHost(_.cloneDeep(panelMeta), $scope.metrics[0].metric, $scope.metrics[0].host));
          $scope.selections[0]=true;
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

        $scope.changeSelect = function (index) {
          if(index == -1){
            $scope.changeAll();
          }else{
            if($scope.selections[index]){
              $scope.addPanel(index);
            }else{
              $scope.removePanel(index);
            }
          }
          $timeout(function() {
            $scope.$broadcast('render');
          });
        };

        $scope.addPanel = function(index) {
          selectNum++;
          if(selectNum == $scope.selections.length){
            $scope.selectAll = true;
          }
          $scope.dashboard.addPanel(setPanelMetaHost(_.cloneDeep(panelMeta), $scope.metrics[index].metric, $scope.metrics[index].host), $scope.dashboard.rows[0]);
        }

        $scope.removePanel = function(index) {
          selectNum--;
          $scope.selectAll = false;
          $scope.dashboard.rows[0].panels.forEach(function(panel, id) {
            if(panel.title.indexOf(_.getMetricName($scope.metrics[index].metric) + ".anomaly{host=" + $scope.metrics[index].host + "}")==0){
              $scope.dashboard.rows[0].panels.splice(id,1);
              return;
            }
          });
        }

        $scope.removeAll = function() {
          selectNum = 0;
          $scope.dashboard.rows[0].panels = [];
        }

        $scope.changeAll = function() {
          $scope.removeAll();
          for(var i in $scope.selections) {
            if($scope.selectAll) {
              $scope.selections[i] = true;
              $scope.addPanel(i);
            } else {
              $scope.selections[i] = false;
            }
          }
        }

        function setPanelMetaHost(panelDef, metric, hostname) {
          metric = _.getMetricName(metric);
          var alias = metric + ".anomaly{host=" + hostname + "}";
          var panel = panelDef;
          panel.title = alias + "指标异常情况";
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
