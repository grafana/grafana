define([
  'angular',
  'jquery',
],
function (angular, $) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('SoloPanelCtrl', function(
    $scope,
    backendSrv,
    $routeParams,
    dashboardSrv,
    timeSrv,
    $location,
    templateValuesSrv,
    contextSrv) {

    var panelId;

    $scope.init = function() {
      contextSrv.sidemenu = false;

      var params = $location.search();
      panelId = parseInt(params.panelId);

      var request;

      if ($routeParams.slug) {
        request = backendSrv.getDashboard($routeParams.slug);
      } else {
        request = backendSrv.get('/api/snapshots/' + $routeParams.key);
      }

      request.then(function(dashboard) {
        $scope.initPanelScope(dashboard);
      }).then(null, function(err) {
        $scope.appEvent('alert-error', ['Load panel error', err.message]);
      });
    };

    $scope.initPanelScope = function(dashboard) {
      $scope.dashboard = dashboardSrv.create(dashboard.model);

      $scope.row = {
        height: ($(window).height() - 10) + 'px',
      };

      $scope.test = "Hej";
      $scope.$index = 0;
      $scope.panel = $scope.dashboard.getPanelById(panelId);

      if (!$scope.panel) {
        $scope.appEvent('alert-error', ['Panel not found', '']);
        return;
      }

      $scope.panel.span = 12;
      $scope.dashboardViewState = { registerPanel: function() { }, state: {}};

      timeSrv.init($scope.dashboard);
      templateValuesSrv.init($scope.dashboard, $scope.dashboardViewState);
    };

    if (!$scope.skipAutoInit) {
      $scope.init();
    }

  });

});
