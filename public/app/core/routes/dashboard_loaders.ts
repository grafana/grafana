import coreModule from '../core_module';

export class LoadDashboardCtrl {

  /** @ngInject */
  constructor($scope, $routeParams, dashboardLoaderSrv, backendSrv, $location) {
    $scope.appEvent("dashboard-fetch-start");

    if (!$routeParams.slug) {
      backendSrv.get('/api/dashboards/home').then(function(homeDash) {
        if (homeDash.redirectUri) {
          $location.path('dashboard/' + homeDash.redirectUri);
        } else {
          var meta = homeDash.meta;
          meta.canSave = meta.canShare = meta.canStar = false;
          $scope.initDashboard(homeDash, $scope);
        }
      });
      return;
    }

    dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
      if ($routeParams.keepRows) {
        result.meta.keepRows = true;
      }
      $scope.initDashboard(result, $scope);
    });
  }
}

export class NewDashboardCtrl {

  /** @ngInject */
  constructor($scope) {
    $scope.initDashboard({
      meta: { canStar: false, canShare: false, isNew: true },
      dashboard: {
        title: "New dashboard",
        rows: [
          {
            title: 'Dashboard Row',
            height: '350px',
            panels: [],
            isNew: true,
          }
        ]
      },
    }, $scope);
  }
}

coreModule.controller('LoadDashboardCtrl', LoadDashboardCtrl);
coreModule.controller('NewDashboardCtrl', NewDashboardCtrl);
