define([
  'angular',
], function (angular) {
  'use strict';
  var module = angular.module('grafana.controllers');
  module.controller('CustomerCtrl', function ($scope, backendSrv) {
    $scope.init = function () {
      backendSrv.get("/api/admin/customer").then(function (data) {
        $scope.customers = data;
      });
    };
    $scope.init();
  });
});