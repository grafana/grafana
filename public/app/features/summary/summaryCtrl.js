define([
    'angular',
    'lodash',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SummaryCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.datasource = null;
        $scope.summarySelect.system = contextSrv.user.systemId;
        $scope.summarySelect.SystemsName = _.find(contextSrv.systemsMap,{Id:$scope.summarySelect.system}).SystemsName;
        $scope.changeSelect();
      };

      if (contextSrv.isGrafanaAdmin) {
        $scope.services = {"collect": "探针状态", "config": "探针配置"};
      } else {
        $scope.services = {"collect": "探针状态"};
      }
      $scope.summarySelect = {
        system: 0,
        services: "collect",
      };

      $scope.summaryList = [];

      $scope.tableHeader = {
        "collect": {
          "IP": "ip",
          "系统版本": "os_version",
          "开始运行时间": "start_time",
          "探针版本": "version",
          "Commit id": "commitId"
        },
        "config": {
          "服务名称": "service",
          "是否正在运行": "enable",
          "间隔": "interval"
        }
      };

      $scope.getSummary = function (query) {
        backendSrv.alertD({
          method: "get",
          url: "/summary",
          params: query,
          headers: {'Content-Type': 'text/plain'},
        }).then(function (response) {
          $scope.summaryList = response.data;
        }).then(function () {
          _.each($scope.summaryList, function (metric) {
            var queries = [{
              "metric": contextSrv.user.orgId + "." + $scope.summarySelect.system + ".collector.state",
              "aggregator": "sum",
              "downsample": "1s-sum",
              "tags": {"host": metric.tag.host}
            }];

            datasourceSrv.getHostStatus(queries, 'now-5m').then(function(response) {
              if(response.status > 0) {
                metric.state = "异常";
              } else {
                metric.state = "正常";
              }
            },function(err) {
              metric.state = "尚未工作";
            });
          });
        })
      };

      $scope.cleanup = function () {
        $scope.summaryList = null;
        $scope.warningScript = null;
      };

      $scope.changeSelect = function () {
        var query = {};
        if ($scope.summarySelect.system == 0 || $scope.summarySelect.services == ""){
          $scope.warningScript = "请选择子系统";
          return;
        }
        $scope.warningScript = "抱歉, 没有任何数据返回";
        if ($scope.summarySelect.services == "collect") {
          query['metrics'] = "collector.summary";
          $scope.getSummary(query);
        } else if ($scope.summarySelect.services == "config") {
          query['metrics'] = "collector.service";
          $scope.getSummary(query);
        }
        return;
      };

      $scope.init();
    });
  });
