// This is empty for now, as I think it's not going to be necessary.
// This replaces Angular RouteProvider implementation with a dummy one to keep the ball rolling
import { navigationLogger } from '@grafana/runtime';
var RouteProvider = /** @class */ (function () {
    function RouteProvider() {
        navigationLogger('Patch angular', false, 'RouteProvider');
    }
    RouteProvider.prototype.$get = function () {
        return this;
    };
    return RouteProvider;
}());
export { RouteProvider };
//# sourceMappingURL=RouteProvider.js.map