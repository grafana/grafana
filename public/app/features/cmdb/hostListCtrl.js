define([
  'angular',
  'lodash',
  './cmdbSetupCtrl',
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostListCtrl', function ($scope, backendSrv, $location, $controller) {
    $scope.init = function() {
      $scope.searchHost = '';
      $scope.order = "'hostname'";
      $scope.desc = false;
      backendSrv.alertD({url:'/cmdb/host'}).then(function(result) {
        $scope.hosts = result.data;
        _.map($scope.hosts, function(host) {
          if(host.isVirtual) {
            return host.isVirtual = '是';
          } else if(host.isVirtual == false) {
            return host.isVirtual = '否';
          } else {
            return host.isVirtual = '未知';
          };
        });
      });
    };

    $scope.getDetail = function(host) {
      $location.url('/cmdb/hostlist/hostdetail?id='+host.id);
    };

    $scope.importList = function() {
      $controller('CMDBSetupCtrl',{$scope: $scope});
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importHosts;
      newScope.getHost = $scope.getHost;
      newScope.fileChanged = $scope.fileChanged;
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.refreshList = function() {
      backendSrv.alertD({url:'/cmdb/scan', method: 'post'});
    };

    $scope.orderBy = function(order) {
      $scope.order = "'"+ order +"'";
      $scope.desc = !$scope.desc;
    };

    $scope.init();
  });
});