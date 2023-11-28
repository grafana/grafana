// This is empty for now, as I think it's not going to be necessary.
// This replaces Angular RouteParamsProvider implementation with a dummy one to keep the ball rolling
import { navigationLogger } from '@grafana/runtime';
export class RouteParamsProvider {
    constructor() {
        this.$get = () => {
            // throw new Error('TODO: Refactor $routeParams');
        };
        navigationLogger('Patch angular', false, 'RouteParamsProvider');
    }
}
//# sourceMappingURL=RouteParamsProvider.js.map