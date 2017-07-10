define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostDetailCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      var id = $location.search().id;
      backendSrv.alertD({url:'/cmdb/host?id='+id}).then(function(response) {
        $scope.detail = response.data;
        $scope.cpuCount = _.countBy(response.data.cpu);
      });
    };

    $scope.init();
  });
});