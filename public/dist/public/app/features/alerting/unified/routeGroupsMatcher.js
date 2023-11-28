import { findMatchingAlertGroups, findMatchingRoutes, normalizeRoute, } from './utils/notification-policies';
export const routeGroupsMatcher = {
    getRouteGroupsMap(rootRoute, groups) {
        const normalizedRootRoute = normalizeRoute(rootRoute);
        function addRouteGroups(route, acc) {
            var _a;
            const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
            acc.set(route.id, routeGroups);
            (_a = route.routes) === null || _a === void 0 ? void 0 : _a.forEach((r) => addRouteGroups(r, acc));
        }
        const routeGroupsMap = new Map();
        addRouteGroups(normalizedRootRoute, routeGroupsMap);
        return routeGroupsMap;
    },
    matchInstancesToRoute(routeTree, instancesToMatch) {
        const result = new Map();
        const normalizedRootRoute = normalizeRoute(routeTree);
        instancesToMatch.forEach((instance) => {
            const matchingRoutes = findMatchingRoutes(normalizedRootRoute, Object.entries(instance));
            matchingRoutes.forEach(({ route, details, labelsMatch }) => {
                // Only to convert Label[] to Labels[] - needs better approach
                const matchDetails = new Map(Array.from(details.entries()).map(([matcher, labels]) => [matcher, Object.fromEntries(labels)]));
                const currentRoute = result.get(route.id);
                if (currentRoute) {
                    currentRoute.push({ instance, matchDetails, labelsMatch });
                }
                else {
                    result.set(route.id, [{ instance, matchDetails, labelsMatch }]);
                }
            });
        });
        return result;
    },
};
//# sourceMappingURL=routeGroupsMatcher.js.map