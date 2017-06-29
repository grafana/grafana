define([
  'angular',
  'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnomalyHistory', function ($scope, healthSrv) {
      $scope.init = function() {
        $scope.anomalyHistoryRange = [
          {'num': 1,'type':'days','value': '过去一天'},
          {'num': 1,'type':'weeks','value': '过去一周'},
          {'num': 1,'type':'months','value': '过去一个月'},
          {'num': 3,'type':'months','value': '过去三个月'},
        ];
        $scope.anomalyTimeSelected = $scope.anomalyHistoryRange[0];
        $scope.loadHistory($scope.anomalyTimeSelected);
      };

      $scope.loadHistory = function(time) {
        var from = Date.parse(moment().subtract(time.num, time.type))/1000;
        var to = Date.parse(moment())/1000;
        healthSrv.loadHistory({from: from, to: to}).then(function(response) {
          $scope.anomalyHistory = [];
          _.each(response.secAtHostToMetrics, function(metrics, timeHost) {
            var time = timeHost.substr(0,10);
            var host = timeHost.substr(11);
            _.each(metrics, function(metric) {
              var anomaly = {
                time: time*1000,
                host: host,
                metric: _.getMetricName(metric)
              };
              $scope.anomalyHistory.push(anomaly);
            });
          })
        });
      };

      $scope.getDetail = function(anomaly) {
      };

      $scope.init();
    });
  });