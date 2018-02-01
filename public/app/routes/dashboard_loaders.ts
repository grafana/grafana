import coreModule from 'app/core/core_module';

export class LoadDashboardCtrl {
  /** @ngInject */
  constructor($scope, $routeParams, dashboardLoaderSrv, backendSrv, $location) {
    $scope.appEvent('dashboard-fetch-start');

    if (!$routeParams.uid && !$routeParams.slug) {
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

    // if no uid, redirect to new route based on slug
    if (!($routeParams.type === 'script' || $routeParams.type === 'snapshot') && !$routeParams.uid) {
      backendSrv.get(`/api/dashboards/db/${$routeParams.slug}`).then(res => {
        if (res) {
          $location.path(res.meta.url).replace();
        }
      });
      return;
    }

    dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug, $routeParams.uid).then(function(result) {
      if ($location.path() !== result.meta.url) {
        $location.path(result.meta.url).replace();
      }

      if ($routeParams.keepRows) {
        result.meta.keepRows = true;
      }
      $scope.initDashboard(result, $scope);
    });
  }
}

export class NewDashboardCtrl {
  /** @ngInject */
  constructor($scope, $routeParams) {
    $scope.initDashboard(
      {
        meta: {
          canStar: false,
          canShare: false,
          isNew: true,
          folderId: Number($routeParams.folderId),
        },
        dashboard: {
          title: 'New dashboard',
          panels: [
            {
              type: 'add-panel',
              gridPos: { x: 0, y: 0, w: 12, h: 9 },
              title: 'Panel Title',
            },
          ],
        },
      },
      $scope
    );
  }
}

coreModule.controller('LoadDashboardCtrl', LoadDashboardCtrl);
coreModule.controller('NewDashboardCtrl', NewDashboardCtrl);
