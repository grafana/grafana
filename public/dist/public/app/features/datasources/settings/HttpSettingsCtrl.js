import { coreModule } from 'app/core/core';
coreModule.directive('datasourceHttpSettings', function () {
    return {
        scope: {
            current: '=',
            suggestUrl: '@',
            noDirectAccess: '@',
            showForwardOAuthIdentityOption: '@',
        },
        templateUrl: 'public/app/features/datasources/partials/http_settings_next.html',
        link: {
            pre: function ($scope) {
                // do not show access option if direct access is disabled
                $scope.showAccessOption = $scope.noDirectAccess !== 'true';
                $scope.onChange = function (datasourceSetting) {
                    $scope.current = datasourceSetting;
                };
            },
        },
    };
});
//# sourceMappingURL=HttpSettingsCtrl.js.map