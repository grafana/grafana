import { coreModule } from 'app/core/core';
coreModule.directive('datasourceHttpSettings', function () {
    return {
        scope: {
            current: '=',
            suggestUrl: '@',
            noDirectAccess: '@',
        },
        templateUrl: 'public/app/features/datasources/partials/http_settings.html',
        link: {
            pre: function ($scope, elem, attrs) {
                // do not show access option if direct access is disabled
                $scope.showAccessOption = $scope.noDirectAccess !== 'true';
                $scope.showAccessHelp = false;
                $scope.toggleAccessHelp = function () {
                    $scope.showAccessHelp = !$scope.showAccessHelp;
                };
                $scope.getSuggestUrls = function () {
                    return [$scope.suggestUrl];
                };
            },
        },
    };
});
//# sourceMappingURL=HttpSettingsCtrl.js.map