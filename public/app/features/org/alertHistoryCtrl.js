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
        $scope.anded = false;
        $scope.alertKey = '';
        $scope.alertHistoryRange = [
          {'key': Date.parse(moment().subtract(1, "days")),'value': '过去一天'},
          {'key': Date.parse(moment().subtract(1, "weeks")),'value': '过去一周'},
          {'key': Date.parse(moment().subtract(1, "months")),'value': '过去一个月'},
          {'key': Date.parse(moment().subtract(3, "months")),'value': '过去三个月'},
        ];
        $scope.alertTimeSelected = $scope.alertHistoryRange[0];
        alertMgrSrv.loadAlertHistory().then(function(response) {
          $scope.alertHistory = response.data;
        });
      };

      $scope.getAlertType = function(alert) {
        if(alert.history.level === 'CRITICAL') {
          return 'crit';
        } else {
          return 'warn';
        }
      };

      $scope.getLevel = function(alert) {
        if(alert.history.level === 'CRITICAL') {
          return '严重';
        } else {
          return '警告';
        }
      };

      $scope.getCloseOp = function(alert) {
        if(alert.history.closeOp === 'AUTO') {
          return '自动关闭';
        } else {
          return alert.history.closeBy;
        }
      };

      $scope.filterRange = function(alert) {
        return alert.history.createdTimeInMillis > $scope.alertTimeSelected.key ;
      }

      $scope.init();
    });
  });
