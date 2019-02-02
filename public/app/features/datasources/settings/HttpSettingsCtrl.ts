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
        $scope.oauthProviders = [
          { key: 'oauth_google', value: 'Google OAuth' },
          { key: 'oauth_gitlab', value: 'GitLab OAuth' },
          { key: 'oauth_generic_oauth', value: 'Generic OAuth' },
          { key: 'oauth_grafana_com', value: 'Grafana OAuth' },
          { key: 'oauth_github', value: 'GitHub OAuth' },
        ];
      },
    },
  };
});
