import { coreModule } from 'app/core/core';

coreModule.directive('datasourceHttpSettings', () => {
  return {
    scope: {
      current: '=',
      suggestUrl: '@',
      noDirectAccess: '@',
    },
    templateUrl: 'public/app/features/datasources/partials/http_settings.html',
    link: {
      pre: ($scope, elem, attrs) => {
        // do not show access option if direct access is disabled
        $scope.showAccessOption = $scope.noDirectAccess !== 'true';
        $scope.showAccessHelp = false;
        $scope.toggleAccessHelp = () => {
          $scope.showAccessHelp = !$scope.showAccessHelp;
        };

        $scope.getSuggestUrls = () => {
          return [$scope.suggestUrl];
        };
      },
    },
  };
});
