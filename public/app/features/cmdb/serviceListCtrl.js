define([
  'angular',
  'lodash',
  './cmdbSetupCtrl',
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ServiceListCtrl', function ($scope, backendSrv, $location, $controller) {
    $scope.init = function() {
      $scope.searchHost = '';
      $scope.order = "'name'";
      $scope.desc = false;
      $scope.refreshTxt = '刷新';
      backendSrv.alertD({url:'/cmdb/service'}).then(function(result) {
        console.log(result);
        $scope.services = result.data.services;
      });
    };

    $scope.getDetail = function(service) {
      $location.url('/cmdb/servicelist/servicedetail?id='+service.id);
    };

    $scope.orderBy = function(order) {
      $scope.order = "'"+ order +"'";
      $scope.desc = !$scope.desc;
    };

    $scope.init();
  });
});