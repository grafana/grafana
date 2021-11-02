import { createMemoryHistory } from 'history';
import { merge } from 'lodash';
export function getRouteComponentProps(overrides) {
    if (overrides === void 0) { overrides = {}; }
    var defaults = {
        history: createMemoryHistory(),
        location: {
            search: '',
        },
        match: { params: {} },
        route: {},
        queryParams: {},
    };
    return merge(overrides, defaults);
}
//# sourceMappingURL=routeProps.js.map