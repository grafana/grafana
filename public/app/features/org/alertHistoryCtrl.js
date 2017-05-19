define([
    'angular',
    'lodash',
    'moment',
  ],
  function (angular, _, moment) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AlertHistoryCtrl', function ($scope, $location, alertMgrSrv, integrateSrv) {
      var annotation_tpl = {
        annotation: {
          datasource: "elk",
          enable: true,
          iconColor: "#C0C6BE",
          iconSize: 15,
          lineColor: "rgba(255, 96, 96, 0.592157)",
          name: "123",
          query: "*",
          showLine: true,
          textField: "123",
          timeField: ""
        },
        min: 1495032982939,
        max: 1495032982939,
        eventType: "123",
        title: ":",
        tags: "历史报警时间",
        text: "",
        score: 1
      };
      $scope.init = function () {
        $scope.alertKey = '';
        $scope.alertHistoryRange = [
          {'num': 1,'type':'days','value': '过去一天'},
          {'num': 1,'type':'weeks','value': '过去一周'},
          {'num': 1,'type':'months','value': '过去一个月'},
          {'num': 3,'type':'months','value': '过去三个月'},
        ];
        $scope.alertTimeSelected = $scope.alertHistoryRange[0];
        $scope.filterRange($scope.alertTimeSelected);

        $scope.getLevel = alertMgrSrv.getLevel;
      };

      $scope.getAlertType = function(alert) {
        if(alert.history.level === 'CRITICAL') {
          return 'crit';
        } else {
          return 'warn';
        }
      };

      $scope.getCloseOp = function(alert) {
        if(alert.history.closeOp === 'AUTO') {
          return '自动关闭';
        } else {
          return alert.history.closeBy;
        }
      };

      $scope.filterRange = function(time) {
        var timestemp = Date.parse(moment().subtract(time.num, time.type));
        alertMgrSrv.loadAlertHistory(timestemp).then(function(response) {
          $scope.alertHistory = response.data;
        });
      };

      $scope.historyDetails = function (index) {
        var target = {
          tags: {},
          downsampleAggregator: "avg",
          downsampleInterval: "1m"
        };
        var details = $scope.alertHistory[index].definition.alertDetails;
        var history = $scope.alertHistory[index].history;
        var start_anno = _.cloneDeep(annotation_tpl);
        var end_anno = _.cloneDeep(annotation_tpl);
        var options = integrateSrv.options;
        target.aggregator = details.hostQuery.metricQueries[0].aggregator.toLowerCase();
        target.metric = details.hostQuery.metricQueries[0].metric;
        target.tags.host = history.host;
        for (var tag in $scope.alertHistory[index].definition.tags) {
          target.tags[tag.name] = tag.value;
        }
        start_anno.min = start_anno.max = history.createdTimeInMillis;
        start_anno.title = "报警开始时间: ";
        end_anno.min = end_anno.max = history.closedTimeInMillis;
        end_anno.title = "报警结束时间: ";
        options.targets = [target];
        options.title = target.metric + "异常情况";

        options.from = moment.utc(history.createdTimeInMillis - 3600000).format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
        options.to = moment.utc(history.closedTimeInMillis + 3600000).format("YYYY-MM-DDTHH:mm:ss.SSS\\Z");
        options.annotations = [start_anno, end_anno];
        $location.path("/integrate");
      };

      $scope.init();
    });
  });
