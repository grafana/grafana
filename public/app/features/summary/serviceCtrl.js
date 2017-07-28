define([
    'angular',
    'lodash',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.systems = contextSrv.systemsMap;
        $scope.summarySelect.system = $scope.systems[0].Id;
        $scope.getServices();
        $scope.suggestTagHost = backendSrv.suggestTagHost;
      };

      if (contextSrv.isGrafanaAdmin) {
        $scope.services = {"collect": "探针状态", "config": "探针配置", "service": "系统状况"};
      } else {
        $scope.services = {"collect": "探针状态", "service": "服务状况"};
      }
      $scope.summarySelect = {
        services: "",
        currentTagValue: "*"
      };

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
        },
        "service": {
          "服务名称": "service",
          // "版本": "version",
          "状态": "state",
          // "运行时间": "running_time"
        }
      };

      $scope.getServices = function () {
        var alias = _.allServies();
        $scope.serviceList = [];
        _.each(Object.keys(alias), function (key) {
          var queries = [{
            "metric": contextSrv.user.orgId + "." + $scope.summarySelect.system + "." + key + ".state",
            "aggregator": "sum",
            "downsample": "1s-sum",
            "tags": {"host": $scope.summarySelect.currentTagValue}
          }];

          datasourceSrv.getStatus(queries, 'now-5m').then(function(response) {
            _.each(response, function(service) {
              var metric = {};
              metric.host = service.tags.host;
              metric.alias = alias[key];
              if (_.isObject(service)) {
                var status = service.dps[Object.keys(service.dps)[0]];
                if(typeof(status) != "number") {
                  throw Error;
                }
                if (status > 0) {
                  metric.state = "异常";
                } else {
                  metric.state = "正常";
                }
              }
              $scope.serviceList.push(metric);
            });
          });
        });
      };

      $scope.cleanup = function () {
        $scope.serviceList = null;
        $scope.warningScript = null;
      };

      $scope.changeSelect = function () {
        $scope.cleanup();
        if ($scope.summarySelect.system == 0) {
          $scope.warningScript = "请选择子系统";
          return;
        } else if ($scope.summarySelect.currentTagValue == "") {
          $scope.warningScript = "请填写主机名";
          return;
        }
        contextSrv.user.systemId = $scope.summarySelect.system;
        $scope.getServices();
      };

      $scope.init();
    });
  });
