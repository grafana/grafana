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
        $scope.services = result.data;
      });
    };

    $scope.getDetail = function(service) {
      $location.url('/cmdb/servicelist/servicedetail?id='+service.id);
    };

    $scope.orderBy = function(order) {
      $scope.order = "'"+ order +"'";
      $scope.desc = !$scope.desc;
    };

    $scope.importList = function() {
      $controller('CMDBSetupCtrl',{$scope: $scope});
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importService;
      newScope.getHost = $scope.getService;
      newScope.fileChanged = $scope.fileChanged;
      newScope.type = 'service';
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.init();
  });
});