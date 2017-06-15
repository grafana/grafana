define([
    'angular',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');
    module.controller('NewComerCtrl', function ($scope, contextSrv, backendSrv) {
      $scope.init = function () {
        backendSrv.updateSystemsMap();
      };

      $scope.init();
    });
  });
