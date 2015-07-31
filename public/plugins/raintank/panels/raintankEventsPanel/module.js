define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankEventsPanel', []);
  app.useModule(module);

  app.useModule(module);
  module.directive('grafanaPanelRaintankeventspanel', function() {
    return {
      controller: 'raintankEventsPanel',
      templateUrl: 'plugins/raintank/panels/raintankEventsPanel/module.html',
    };
  });

  module.controller('raintankEventsPanel', function($scope, panelSrv, timeSrv, backendSrv, templateSrv) {
    $scope.panelMeta = new PanelMeta({
      panelName: 'Raintank Events',
      description : "Events",
      fullscreen: true
    });
    $scope.panelMeta.addEditorTab('Filter', 'plugins/raintank/panels/raintankEventsPanel/editor.html');

    // Set and populate defaults
    var _d = {
      filter: null,
      title: "Events",
      size: 10
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);
    };

    $scope.refreshData = function() {
      $scope.range = timeSrv.timeRange();
      if (!$scope.panel.filter) {
        return;
      }
      if ($scope.panel.filter.indexOf(":", $scope.panel.filter.length - 1) !== -1) {
        //filter ends with a colon. elasticsearch will send a 500error for this.
        return;
      }

      var params = {
        query: templateSrv.replace($scope.panel.filter, $scope.panel.scopedVars),
        start: $scope.range.from.getTime(),
        end:  $scope.range.to.getTime(),
        size: $scope.panel.size,
      };

      backendSrv.get('/api/events', params).then(function(events) {
        $scope.events = events;
        $scope.panel.scopedVars['eventCount'] = {selected: true, text: events.length, value: events.length};
      });
    };

    $scope.init();
  });
});
