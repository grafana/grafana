define([
    'angular',
    'lodash',
    'app/core/utils/datemath'
  ],
  function (angular, _, dateMath) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ReportCtrl', function ($scope, backendSrv, contextSrv, datasourceSrv) {
      $scope.init = function () {
      };
      $scope.init();
    });
  });
