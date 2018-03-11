import angular from 'angular';

export class OrgApiKeysCtrl {
  /** @ngInject **/
  constructor($scope, $http, backendSrv, navModelSrv) {
    $scope.navModel = navModelSrv.getNav('cfg', 'apikeys', 0);

    $scope.roleTypes = ['Viewer', 'Editor', 'Admin'];
    $scope.token = { role: 'Viewer' };

    $scope.init = function() {
      $scope.getTokens();
    };

    $scope.getTokens = function() {
      backendSrv.get('/api/auth/keys').then(function(tokens) {
        $scope.tokens = tokens;
      });
    };

    $scope.removeToken = function(id) {
      backendSrv.delete('/api/auth/keys/' + id).then($scope.getTokens);
    };

    $scope.addToken = function() {
      backendSrv.post('/api/auth/keys', $scope.token).then(function(result) {
        var modalScope = $scope.$new(true);
        modalScope.key = result.key;
        modalScope.rootPath = window.location.origin + $scope.$root.appSubUrl;

        $scope.appEvent('show-modal', {
          src: 'public/app/features/org/partials/apikeyModal.html',
          scope: modalScope,
        });

        $scope.getTokens();
      });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('OrgApiKeysCtrl', OrgApiKeysCtrl);
