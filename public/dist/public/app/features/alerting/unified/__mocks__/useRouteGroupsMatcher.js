import { __awaiter } from "tslib";
import { useCallback } from 'react';
import { routeGroupsMatcher } from '../routeGroupsMatcher';
export function useRouteGroupsMatcher() {
    const getRouteGroupsMap = useCallback((route, groups) => __awaiter(this, void 0, void 0, function* () {
        return routeGroupsMatcher.getRouteGroupsMap(route, groups);
    }), []);
    const matchInstancesToRoute = useCallback((rootRoute, instancesToMatch) => __awaiter(this, void 0, void 0, function* () {
        return routeGroupsMatcher.matchInstancesToRoute(rootRoute, instancesToMatch);
    }), []);
    return { getRouteGroupsMap, matchInstancesToRoute };
}
//# sourceMappingURL=useRouteGroupsMatcher.js.map