define([
  'angular',
  'app/app',
  'lodash',
  'app/components/panelmeta',
],
function (angular, app, _, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankCallToAction', []);
  app.useModule(module);

  app.useModule(module);
  module.directive('grafanaPanelRaintankcalltoaction', function() {
    return {
      controller: 'raintankCallToAction',
      templateUrl: 'plugins/raintank/panels/raintankCallToAction/module.html',
    };
  });

  module.controller('raintankCallToAction', function($scope, panelSrv, backendSrv) {
    $scope.panelMeta = new PanelMeta({
      panelName: 'Raintank Call To Action',
      description : "Call To Action",
      fullscreen: false
    });
    $scope.panel.title = "";

    $scope.endpointStatus = "scopeEndpoints";
    $scope.userStatus = "scopeUsers";
    $scope.collectorStatus = "scopeCollectors";

    // Set and populate defaults
    $scope.init = function() {
      panelSrv.init(this);
    };

    $scope.setEndpointStatus = function() {
      if (! $scope.quotas) {
        return;
      }
      if ($scope.quotas.endpoint.used === 0) {
        $scope.endpointStatus = "noEndpoints";
        return;
      }
      if ($scope.quotas.endpoint.used >= 1) {
        $scope.endpointStatus = "hasEndpoints";
        return;
      }
      //default.
      $scope.endpointStatus = "hasEndpoints";
      return;
    };

    $scope.setUserStatus = function() {
      if (! $scope.quotas) {
        return;
      }
      if ($scope.quotas.org_user.used <= 1) {
        $scope.userStatus = "noTeam";
        return;
      }
      if ($scope.quotas.org_user.used >= 2) {
        $scope.userStatus = "hasTeam";
        return;
      }
      //default.
      $scope.userStatus = "hasTeam";
      return;
    };

    $scope.setCollectorStatus = function() {
      if (! $scope.quotas) {
        return;
      }
      if ($scope.quotas.collector.used === 0) {
        $scope.collectorStatus = "noCollectors";
        return;
      }
      if ($scope.quotas.collector.used >= 1) {
        $scope.collectorStatus = "hasCollectors";
        return;
      }
      //default.
      $scope.collectorStatus = "hasCollectors";
      return;
    };

    $scope.allDone = function() {
      if (! $scope.quotas) {
        return false;
      }
      if ($scope.quotas.collector.used === 0) {
        return false;
      }
      if ($scope.quotas.org_user.used <= 1) {
        return false;
      }
      if ($scope.quotas.endpoint.used === 0) {
        return false;
      }
      //default.
      return true;
    };

    $scope.refreshData = function() {

      backendSrv.get('/api/org/quotas').then(function(quotas) {
        var quotaHash = {};
        _.forEach(quotas, function(q) {
          quotaHash[q.target] = q;
        });
        $scope.quotas = quotaHash;
        $scope.setEndpointStatus();
        $scope.setUserStatus();
        $scope.setCollectorStatus();
      });
    };

    $scope.init();
  });
});
