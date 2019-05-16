import { coreModule } from 'app/core/core';
import { createChangeHandler, createResetHandler, PasswordFieldEnum } from '../utils/passwordHandlers';

coreModule.directive('datasourceHttpSettings', () => {
  return {
    scope: {
      current: '=',
      suggestUrl: '@',
      noDirectAccess: '@',
    },
    templateUrl: 'public/app/features/datasources/partials/http_settings.html',
    link: {
      pre: ($scope: any, elem, attrs) => {
        // do not show access option if direct access is disabled
        $scope.showAccessOption = $scope.noDirectAccess !== 'true';
        $scope.showAccessHelp = false;
        $scope.toggleAccessHelp = () => {
          $scope.showAccessHelp = !$scope.showAccessHelp;
        };

        $scope.getSuggestUrls = () => {
          return [$scope.suggestUrl];
        };

        $scope.onBasicAuthPasswordReset = createResetHandler($scope, PasswordFieldEnum.BasicAuthPassword);
        $scope.onBasicAuthPasswordChange = createChangeHandler($scope, PasswordFieldEnum.BasicAuthPassword);
      },
    },
  };
});
