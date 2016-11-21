define([
    'angular',
    'lodash',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AlertHistoryCtrl', function ($scope, alertMgrSrv) {
      $scope.init = function () {
        $scope.anded = false;
      };

      $scope.init();
    });
  });
