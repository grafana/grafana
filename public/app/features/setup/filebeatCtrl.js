define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('FilebeatCtrl', function($scope, backendSrv) {
    $scope.init = function() {
      $scope.token = backendSrv.getToken();
    }

    $scope.init();
  });
});