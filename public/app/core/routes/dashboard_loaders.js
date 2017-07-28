define([
  '../core_module',
],
function (coreModule) {
  "use strict";

  coreModule.default.controller('LoadDashboardCtrl', function($scope, $routeParams, dashboardLoaderSrv, backendSrv) {

    if (!$routeParams.slug) {
      backendSrv.get('/api/dashboards/home').then(function(result) {
        var meta = result.meta;
        meta.canSave = meta.canShare = meta.canStar = false;
        $scope.initDashboard(result, $scope);
      });
      return;
    }

    dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
      $scope.initDashboard(result, $scope);
    });

  });

  coreModule.default.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {
    if (!window.grafanaImportDashboard) {
      alertSrv.set('抱歉', '不能在没有保存的情况下刷新页面', 'warning', 7000);
      $location.path('');
      return;
    }
    $scope.initDashboard({
      meta: { canShare: false, canStar: false },
      dashboard: window.grafanaImportDashboard
    }, $scope);
  });

  coreModule.default.controller('NewDashboardCtrl', function($scope, $routeParams) {
    var newTitle = $routeParams.title || "新的仪表盘";
    var newSystem = $routeParams.system;
    $scope.initDashboard({
      meta: { canStar: false, canShare: false },
      dashboard: {
        title: newTitle,
        system: newSystem,
        rows: [{ height: '250px', panels:[] }],
        time: {from: "now-6h", to: "now"},
        refresh: "30s",
      },
    }, $scope);
  });

});
