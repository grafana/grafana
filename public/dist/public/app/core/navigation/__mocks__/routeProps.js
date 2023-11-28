import { createMemoryHistory } from 'history';
import { merge } from 'lodash';
export function getRouteComponentProps(overrides = {}) {
    const defaults = {
        history: createMemoryHistory(),
        location: {
            hash: '',
            pathname: '',
            state: {},
            search: '',
        },
        match: { params: {} },
        route: {
            path: '',
            component: () => null,
        },
        queryParams: {},
    };
    return merge(overrides, defaults);
}
//# sourceMappingURL=routeProps.js.map