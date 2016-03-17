define([
  '../core_module',
],
function (coreModule) {
  "use strict";

  coreModule.default.controller('LoadDashboardCtrl', function($scope, $routeParams, dashboardLoaderSrv, backendSrv) {

    if (!$routeParams.slug) {

      backendSrv.get('/api/preferences').then(function(preferences) {
        if (preferences !== null && preferences.homeDashboardId !== 0) {
          backendSrv.get('/api/dashboards/id/' + preferences.homeDashboardId).then(function(dashSlug) {
            $routeParams.type = 'db';
            $routeParams.slug = dashSlug.slug;
            dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
              $scope.initDashboard(result, $scope);
            });
          });
        } else {
          backendSrv.get('/api/dashboards/home').then(function(result) {
            var meta = result.meta;
            meta.canSave = meta.canShare = meta.canStar = false;
            $scope.initDashboard(result, $scope);
          });
        }
      });

      return;
    }

    dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
      $scope.initDashboard(result, $scope);
    });

  });

  coreModule.default.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {
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

  coreModule.default.controller('NewDashboardCtrl', function($scope) {
    $scope.initDashboard({
      meta: { canStar: false, canShare: false },
      dashboard: {
        title: "New dashboard",
        rows: [{ height: '250px', panels:[] }]
      },
    }, $scope);
  });

});
