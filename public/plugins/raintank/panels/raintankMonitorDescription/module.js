define([
  'angular',
  'app/app',
  'lodash',
  'kbn',
  'app/components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankMonitorDescription', []);
  app.useModule(module);

  app.useModule(module);
  module.directive('grafanaPanelRaintankmonitordescription', function() {
    return {
      controller: 'raintankMonitorDescription',
      templateUrl: 'plugins/raintank/panels/raintankMonitorDescription/module.html',
    };
  });

  module.controller('raintankMonitorDescription', function($scope, panelSrv, backendSrv) {
    $scope.panelMeta = new PanelMeta({
      panelName: 'Monitor Description',
      description : "Raintank Monitor details.",
      fullscreen: true
    });
    $scope.panelMeta.addEditorTab('Monitor ID', 'plugins/raintank/panels/raintankMonitorDescription/editor.html');
    // Set and populate defaults
    var _d = {
      monitor: null,
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);
      $scope.$on('refresh', $scope.render);
      $scope.render();
    };

    $scope.render = function() {
      if ($scope.panel.monitor) {
        backendSrv.get('/api/monitors/'+$scope.panel.monitor).then(function(monitor) {
          $scope.monitor = monitor;
          backendSrv.get('/api/monitor_types').then(function(types) {
            var found = false;
            _.forEach(types, function(type) {
              if (found) {
                return;
              }
              if (type.id === monitor.monitor_type_id) {
                $scope.monitor_type = type;
              }
            });
          });
        });
      }
    };

    $scope.init();
  });

});
