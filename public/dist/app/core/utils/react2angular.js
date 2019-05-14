import coreModule from 'app/core/core_module';
import { provideTheme } from 'app/core/utils/ConfigProvider';
export function react2AngularDirective(name, component, options) {
    coreModule.directive(name, [
        'reactDirective',
        function (reactDirective) {
            return reactDirective(provideTheme(component), options);
        },
    ]);
}
//# sourceMappingURL=react2angular.js.map