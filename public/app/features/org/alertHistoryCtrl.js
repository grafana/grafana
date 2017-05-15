define([
    'angular',
    'lodash',
    'moment',
  ],
  function (angular, _, moment) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AlertHistoryCtrl', function ($scope, alertMgrSrv) {
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
      }

      $scope.init();
    });
  });
