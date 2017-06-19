define([
    'angular',
    'lodash',
    'app/core/utils/datemath'
  ],
  function (angular, _, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SummaryCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.datasource = null;
        backendSrv.get("/api/user/system").then(function (system) {
          $scope.systems = system;
          $scope.summarySelect.system = system[0].Id;
        }).then(function () {
          _.each(datasourceSrv.getAll(), function (ds) {
            if (ds.type === 'opentsdb') {
              datasourceSrv.get(ds.name).then(function (datasource) {
                $scope.datasource = datasource;
              }).then(function () {
                $scope.changeSelect();
              });
            }
          });
        });

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
              "downsample": "1m-sum",
              "tags": {"host": metric.tag.host}
            }];

            $scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-1m', false).valueOf(), null).then(function (response) {
              if (_.isEmpty(response.data)) {
                throw Error;
              }
              _.each(response.data, function (metricData) {
                if (_.isObject(metricData)) {
                  if (metricData.dps[Object.keys(metricData.dps)[0]] > 0) {
                    metric.state = "异常";
                  } else {
                    metric.state = "正常";
                  }
                }
              });
            }).catch(function () {
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
        contextSrv.user.systemId = $scope.summarySelect.system;
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
