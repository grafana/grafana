define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  'jquery',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('LoadDashboardCtrl', function($scope, $routeParams, dashboardLoaderSrv, backendSrv) {

    if (!$routeParams.slug) {
      backendSrv.get('/api/dashboards/home').then(function(result) {
        var meta = result.meta;
        meta.canSave = meta.canShare = meta.canEdit = meta.canStar = false;
        $scope.initDashboard(result, $scope);
      });
      return;
    }

    dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
      $scope.initDashboard(result, $scope);
    });

  });

  module.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {
    if (!window.grafanaImportDashboard) {
      alertSrv.set('Not found', 'Cannot reload page with unsaved imported dashboard', 'warning', 7000);
      $location.path('');
      return;
    }
    $scope.initDashboard({
      meta: { canShare: false, canStar: false },
      dashboard: window.grafanaImportDashboard
    }, $scope);
  });

  module.controller('NewDashboardCtrl', function($scope) {
    $scope.initDashboard({
      meta: { canStar: false, canShare: false },
      dashboard: {
        title: "New dashboard",
        rows: [{ height: '250px', panels:[] }]
      },
    }, $scope);
  });

});
