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
        $scope.services = {"collect": "探针状态", "config": "探针配置", "service": "服务状况"};
      } else {
        $scope.services = {"collect": "探针状态", "service": "服务状况"};
      }
      $scope.summarySelect = {
        system: 0,
        services: "",
        currentTagValue: "*"
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
        },
        "service": {
          "服务名称": "service",
          // "版本": "version",
          "状态": "state",
          // "运行时间": "running_time"
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
          "zookeeper": "Zookeeper"
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
            $scope.summaryList = response;
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
          }).catch(function (e) {
            $scope.serviceList.push({"alias": alias[key], "state": "尚未工作"});
          });
        });
      };

      $scope.cleanup = function () {
        $scope.serviceList = null;
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
        } else if ($scope.summarySelect.services == "service" && $scope.summarySelect.currentTagValue != "") {
          $scope.getServices();
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
