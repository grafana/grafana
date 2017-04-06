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
        };
        var selectNum = 0;
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

          selectNum++;
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

        $(window).scroll(function (event) {
          if(window.scrollY>=60){
            $scope.$apply(function() {
              $scope.toTop = true;
            });
          }else{
            $scope.$apply(function() {
              $scope.toTop = false;
            });
          }
        });

        $scope.changeSelect = function (index) {
          if(index == -1){
            changeAll();
          }else{
            if($scope.selections[index]){
              addPanel(index);
            }else{
              removePanel(index);
            }
          }
        };

        function addPanel(index) {
          selectNum++;
          if(selectNum == $scope.selections.length){
            $scope.selectAll = true;
          }
          $scope.dashboard.addPanel(setPanelMetaHost(_.cloneDeep(panelMeta), $scope.metrics[index].metric, $scope.metrics[index].host), $scope.dashboard.rows[0]);
          $scope.$broadcast('render');
        }

        function removePanel(index) {
          selectNum--;
          $scope.selectAll = false;
          _.each($scope.dashboard.rows[0].panels,function(panel,id) {
            if(panel.title.indexOf(_.getMetricName($scope.metrics[index].metric))==0){
              $scope.dashboard.rows[0].panels.splice(id,1);
              $scope.$broadcast('render');
            }
          });
        }

        function removeAll() {
          selectNum = 0;
          $scope.dashboard.rows[0].panels = [];
          $scope.$broadcast('render');
        }

        function changeAll() {
          if($scope.selectAll){
            removeAll()
            for(var i in $scope.selections){
              $scope.selections[i] = true;
              addPanel(i);
            }
          } else {
            removeAll()
            for(var i in $scope.selections){
              $scope.selections[i] = false;
            }
          }
        }

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
          panel.seriesOverrides[2].alias = metric + ".prediction.max{host=" + hostname + "}";

          return panelDef;
        }

        $scope.init();
      }
    );
  });
