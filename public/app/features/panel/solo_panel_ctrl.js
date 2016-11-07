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

      $scope.onAppEvent("dashboard-initialized", $scope.initPanelScope);

      dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
        result.meta.soloMode = true;
        $scope.initDashboard(result, $scope);
      });
    };

    $scope.initPanelScope = function() {
      var panelInfo = $scope.dashboard.getPanelInfoById(panelId);

      // fake row ctrl scope
      $scope.ctrl = {
        row: panelInfo.row,
        dashboard: $scope.dashboard,
      };

      $scope.ctrl.row.height = $(window).height();
      $scope.panel = panelInfo.panel;
      $scope.$index = 0;

      if (!$scope.panel) {
        $scope.appEvent('alert-error', ['Panel not found', '']);
        return;
      }

      $scope.panel.span = 12;
    };

    $scope.init();
  });
});
