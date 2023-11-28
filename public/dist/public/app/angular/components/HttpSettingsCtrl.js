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
            pre: ($scope) => {
                // do not show access option if direct access is disabled
                $scope.showAccessOption = $scope.noDirectAccess !== 'true';
                $scope.onChange = (datasourceSetting) => {
                    $scope.current = datasourceSetting;
                };
            },
        },
    };
});
//# sourceMappingURL=HttpSettingsCtrl.js.map