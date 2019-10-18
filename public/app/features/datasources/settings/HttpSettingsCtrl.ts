import { coreModule } from 'app/core/core';

coreModule.directive('datasourceHttpSettings', () => {
  return {
    scope: {
      current: '=',
      suggestUrl: '@',
      noDirectAccess: '@',
    },
    templateUrl: 'public/app/features/datasources/partials/http_settings_next.html',
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
