define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostListCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      $scope.searchHost = '';
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
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importHosts;
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.importHosts = function() {
      console.log('importHosts');
    };

    $scope.init();
  });
});