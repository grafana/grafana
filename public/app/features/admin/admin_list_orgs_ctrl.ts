import angular from 'angular';

export class AdminListOrgsCtrl {
  /** @ngInject */
  constructor($scope, backendSrv, navModelSrv) {
    $scope.init = function() {
      $scope.navModel = navModelSrv.getNav('cfg', 'admin', 'global-orgs', 1);
      $scope.getOrgs();
    };

    $scope.getOrgs = function() {
      backendSrv.get('/api/orgs').then(function(orgs) {
        $scope.orgs = orgs;
      });
    };

    $scope.deleteOrg = function(org) {
      $scope.appEvent('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete organization ' + org.name + '?',
        text2: 'All dashboards for this organization will be removed!',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          backendSrv.delete('/api/orgs/' + org.id).then(function() {
            $scope.getOrgs();
          });
        },
      });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('AdminListOrgsCtrl', AdminListOrgsCtrl);
