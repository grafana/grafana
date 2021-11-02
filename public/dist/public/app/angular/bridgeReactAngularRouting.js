import { coreModule } from '../core/core_module';
import { RouteProvider } from '../core/navigation/patch/RouteProvider';
import { RouteParamsProvider } from '../core/navigation/patch/RouteParamsProvider';
import { AngularLocationWrapper } from './AngularLocationWrapper';
// Neutralizing Angular’s location tampering
// https://stackoverflow.com/a/19825756
var tamperAngularLocation = function () {
    coreModule.config([
        '$provide',
        function ($provide) {
            $provide.decorator('$browser', [
                '$delegate',
                function ($delegate) {
                    $delegate.onUrlChange = function () { };
                    $delegate.url = function () { return ''; };
                    return $delegate;
                },
            ]);
        },
    ]);
};
// Intercepting $location service with implementation based on history
var interceptAngularLocation = function () {
    coreModule.config([
        '$provide',
        function ($provide) {
            $provide.decorator('$location', [
                '$delegate',
                function ($delegate) {
                    $delegate = new AngularLocationWrapper();
                    return $delegate;
                },
            ]);
        },
    ]);
    coreModule.provider('$route', RouteProvider);
    coreModule.provider('$routeParams', RouteParamsProvider);
};
export function initAngularRoutingBridge() {
    tamperAngularLocation();
    interceptAngularLocation();
}
//# sourceMappingURL=bridgeReactAngularRouting.js.map