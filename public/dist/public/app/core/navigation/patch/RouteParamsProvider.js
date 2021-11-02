// This is empty for now, as I think it's not going to be necessary.
// This replaces Angular RouteParamsProvider implementation with a dummy one to keep the ball rolling
import { navigationLogger } from '@grafana/runtime';
var RouteParamsProvider = /** @class */ (function () {
    function RouteParamsProvider() {
        this.$get = function () {
            // throw new Error('TODO: Refactor $routeParams');
        };
        navigationLogger('Patch angular', false, 'RouteParamsProvider');
    }
    return RouteParamsProvider;
}());
export { RouteParamsProvider };
//# sourceMappingURL=RouteParamsProvider.js.map