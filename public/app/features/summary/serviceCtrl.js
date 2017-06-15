define([
    'angular',
    'lodash',
    'app/core/utils/datemath'
  ],
  function (angular, _, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ServiceCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
        $scope.systems = contextSrv.systemsMap;
        $scope.summarySelect.system = $scope.systems[0].Id;
        datasourceSrv.get('opentsdb').then(function (datasource) {
          $scope.datasource = datasource;
        }).then(function () {
          $scope.getServices();
        });
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
        var alias = {
          "hadoop.datanode": "Hadoop DataNode",
          "hadoop.namenode": "Hadoop NameNode",
          "hbase.master": "Hbase Master",
          "hbase.regionserver": "Hbase RegionServer",
          "kafka": "Kafka",
          "mysql": "Mysql",
          "spark": "Spark",
          "storm": "Storm",
          "yarn": "Yarn",
          "zookeeper": "Zookeeper",
          "tomcat": "Tomcat",
          "opentsdb": "OpenTSDB",
          "mongo3": "MongoDB 3.x",
          "nginx": "Nginx"
        };

        $scope.serviceList = [];
        _.each(Object.keys(alias), function (key) {
          var queries = [{
            "metric": contextSrv.user.orgId + "." + $scope.summarySelect.system + "." + key + ".state",
            "aggregator": "sum",
            "downsample": "1h-sum",
            "tags": {"host": $scope.summarySelect.currentTagValue}
          }];

          $scope.datasource.performTimeSeriesQuery(queries, dateMath.parse('now-1h', false).valueOf(), null).then(function (response) {
            if(_.isEmpty(response.data)){
              throw Error;
            }
            _.each(response.data, function (metricData) {
              var metric = {};
              metric.host = metricData.tags.host;
              metric.alias = alias[key];
              if (_.isObject(metricData)) {
                if (metricData.dps[Object.keys(metricData.dps)[0]] > 0) {
                  metric.state = "异常";
                } else {
                  metric.state = "正常";
                }
              }
              $scope.serviceList.push(metric);
            });
          }).catch(function () {
            //nothing to do;
            //$scope.serviceList.push({"host": "尚未配置在任何主机上", "alias": alias[key], "state": "尚未工作"});
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
