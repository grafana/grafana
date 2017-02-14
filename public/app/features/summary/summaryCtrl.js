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
        _.each(datasourceSrv.getAll(), function (ds) {
          if (ds.type === 'opentsdb') {
            datasourceSrv.get(ds.name).then(function (datasource) {
              $scope.datasource = datasource;
            });
          }
        });
      };

      if (contextSrv.isGrafanaAdmin) {
        $scope.services = {"collect": "探针状态", "config": "探针配置"};
      } else {
        $scope.services = {"collect": "探针状态"};
      }
      $scope.summarySelect = {
        system: 0,
        services: "",
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
        });
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
        contextSrv.system = $scope.summarySelect.system;
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

      $scope.getTextValues = function (metricFindResult) {
        return _.map(metricFindResult, function (value) {
          return value.text;
        });
      };

      $scope.suggestTagValues = function (query, callback) {
        $scope.datasource.metricFindQuery('suggest_tagv(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.init();
    });
  });
