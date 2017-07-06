define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostDetailCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      var id = $location.search().id;
      console.log(id);
      backendSrv.get('/api/static/alertd/host.detail').then(function(response) {
        $scope.detail = response;
      });
    };

    $scope.init();
  });
});