define([
    'angular',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ReportCtrl', function (
      $scope, backendSrv, contextSrv) {
      $scope.init = function () {
        $scope.reports = [];
        backendSrv.get('/api/static/template/'+contextSrv.user.orgId).then(function(result) {
          $scope.reports = result.reports;
        });
      };
      $scope.init();
    });
  });
