export function isDefaultPolicy(route) {
    var _a;
    return ((_a = route.path) === null || _a === void 0 ? void 0 : _a.length) === 0;
}
// we traverse the whole tree and we create a map with <id , RouteWithPath>
export function getRoutesByIdMap(rootRoute) {
    const map = new Map();
    function addRoutesToMap(route, path = []) {
        var _a;
        map.set(route.id, Object.assign(Object.assign({}, route), { path: path }));
        (_a = route.routes) === null || _a === void 0 ? void 0 : _a.forEach((r) => addRoutesToMap(r, [...path, route.id]));
    }
    addRoutesToMap(rootRoute, []);
    return map;
}
export function hasEmptyMatchers(route) {
    var _a;
    return ((_a = route.object_matchers) === null || _a === void 0 ? void 0 : _a.length) === 0;
}
//# sourceMappingURL=route.js.map