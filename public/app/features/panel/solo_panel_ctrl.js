define([
  'angular',
  'jquery',
],
function (angular, $) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('SoloPanelCtrl', function($scope, $routeParams, $location, dashboardLoaderSrv, contextSrv) {

    var panelId;

    $scope.init = function() {
      contextSrv.sidemenu = false;

      var params = $location.search();
      panelId = parseInt(params.panelId);

      dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
        $scope.initDashboard(result, $scope);
      });

      $scope.onAppEvent("dashboard-loaded", $scope.initPanelScope);
    };

    $scope.initPanelScope = function() {
      $scope.row = {
        height: $(window).height() + 'px',
      };

      $scope.test = "Hej";
      $scope.$index = 0;
      $scope.panel = $scope.dashboard.getPanelById(panelId);

      if (!$scope.panel) {
        $scope.appEvent('alert-error', ['Panel not found', '']);
        return;
      }

      $scope.panel.span = 12;
      $scope.dashboardViewState = {registerPanel: function() { }, state: {}};
    };

    if (!$scope.skipAutoInit) {
      $scope.init();
    }

  });

});
