import { coreModule } from 'app/angular/core_module';

coreModule.directive('datasourceHttpSettings', () => {
  return {
    scope: {
      current: '=',
      suggestUrl: '@',
      noDirectAccess: '@',
      showForwardOAuthIdentityOption: '@',
    },
    templateUrl: 'public/app/angular/partials/http_settings_next.html',
    link: {
      pre: ($scope: any) => {
        // do not show access option if direct access is disabled
        $scope.showAccessOption = $scope.noDirectAccess !== 'true';
        $scope.onChange = (datasourceSetting: any) => {
          $scope.current = datasourceSetting;
        };
      },
    },
  };
});
