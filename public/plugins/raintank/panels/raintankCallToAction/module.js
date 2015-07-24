define([
  'angular',
  'app',
  'lodash',
  'components/panelmeta',
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
    $scope.cta = "addEndpoint";

    // Set and populate defaults
    $scope.init = function() {
      panelSrv.init(this);
    };

    $scope.setCTA = function() {
      console.log($scope.quotas);
      if ($scope.quotas.endpoint.used === 0) {
        $scope.cta = "addEndpoint";
        return;
      }
      if ($scope.quotas.user.used <= 1) {
        $scope.cta = "addUser";
        return;
      }
      if ($scope.quotas.collector.used === 0) {
        $scope.cta = "addCollector";
        return;
      }
      if ($scope.quotas.data_source.used === 0) {
        $scope.cta = "addDatasource";
        return;
      }
      //default.
      $scope.cta = "addEndpoint";
      return;
    };

    $scope.refreshData = function() {

      backendSrv.get('/api/org/quotas').then(function(quotas) {
        var quotaHash = {};
        _.forEach(quotas, function(q) {
          quotaHash[q.target] = q;
        });
        $scope.quotas = quotaHash;
        $scope.setCTA();
      });
    };

    $scope.init();
  });
});
