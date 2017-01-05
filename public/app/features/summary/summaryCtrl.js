define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SummaryCtrl', function ($scope, backendSrv, contextSrv) {

      $scope.services = {"collect": "探针状态", "service": "服务状态"};
      $scope.summarySelect = {
        system: 0,
        services: ""
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
        "service": {
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

      $scope.changeSelect = function () {
        var query = {};
        if ($scope.summarySelect.system == 0 || $scope.summarySelect.services == "")
          return;

        contextSrv.system = $scope.summarySelect.system;
        if ($scope.summarySelect.services == "collect") {
          query['metrics'] = "collector.summary";
          $scope.getSummary(query);
          //host? port? another tag?
        } else if ($scope.summarySelect.services == "service") {
          query['metrics'] = "collector.service";
          $scope.getSummary(query);
        }
        return; //do nothing;
      }
    });
  });
