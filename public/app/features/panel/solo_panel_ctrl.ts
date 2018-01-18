import angular from 'angular';

export class SoloPanelCtrl {
  /** @ngInject */
  constructor($scope, $routeParams, $location, dashboardLoaderSrv, contextSrv) {
    var panelId;

    $scope.init = function() {
      contextSrv.sidemenu = false;

      var params = $location.search();
      panelId = parseInt(params.panelId);

      $scope.onAppEvent('dashboard-initialized', $scope.initPanelScope);

      dashboardLoaderSrv.loadDashboard($routeParams.type, $routeParams.slug).then(function(result) {
        result.meta.soloMode = true;
        $scope.initDashboard(result, $scope);
      });
    };

    $scope.initPanelScope = function() {
      let panelInfo = $scope.dashboard.getPanelInfoById(panelId);

      // fake row ctrl scope
      $scope.ctrl = {
        dashboard: $scope.dashboard,
      };

      $scope.panel = panelInfo.panel;
      $scope.panel.soloMode = true;
      $scope.$index = 0;

      if (!$scope.panel) {
        $scope.appEvent('alert-error', ['Panel not found', '']);
        return;
      }
    };

    $scope.init();
  }
}

angular.module('grafana.routes').controller('SoloPanelCtrl', SoloPanelCtrl);
