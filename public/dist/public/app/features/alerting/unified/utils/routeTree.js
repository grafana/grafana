/**
 * Various helper functions to modify (immutably) the route tree, aka "notification policies"
 */
import { omit } from 'lodash';
import { formAmRouteToAmRoute } from './amroutes';
// add a form submission to the route tree
export const mergePartialAmRouteWithRouteTree = (alertManagerSourceName, partialFormRoute, routeTree) => {
    var _a;
    const existing = findExistingRoute((_a = partialFormRoute.id) !== null && _a !== void 0 ? _a : '', routeTree);
    if (!existing) {
        throw new Error(`No such route with ID '${partialFormRoute.id}'`);
    }
    function findAndReplace(currentRoute) {
        var _a;
        let updatedRoute = currentRoute;
        if (currentRoute.id === partialFormRoute.id) {
            const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);
            updatedRoute = omit(Object.assign(Object.assign({}, currentRoute), newRoute), 'id');
        }
        return omit(Object.assign(Object.assign({}, updatedRoute), { routes: (_a = currentRoute.routes) === null || _a === void 0 ? void 0 : _a.map(findAndReplace) }), 'id');
    }
    return findAndReplace(routeTree);
};
// remove a route from the policy tree, returns a new tree
// make sure to omit the "id" because Prometheus / Loki / Mimir will reject the payload
export const omitRouteFromRouteTree = (findRoute, routeTree) => {
    if (findRoute.id === routeTree.id) {
        throw new Error('You cant remove the root policy');
    }
    function findAndOmit(currentRoute) {
        var _a;
        return omit(Object.assign(Object.assign({}, currentRoute), { routes: (_a = currentRoute.routes) === null || _a === void 0 ? void 0 : _a.reduce((acc = [], route) => {
                if (route.id === findRoute.id) {
                    return acc;
                }
                acc.push(findAndOmit(route));
                return acc;
            }, []) }), 'id');
    }
    return findAndOmit(routeTree);
};
// add a new route to a parent route
export const addRouteToParentRoute = (alertManagerSourceName, partialFormRoute, parentRoute, routeTree) => {
    const newRoute = formAmRouteToAmRoute(alertManagerSourceName, partialFormRoute, routeTree);
    function findAndAdd(currentRoute) {
        var _a, _b;
        if (currentRoute.id === parentRoute.id) {
            return Object.assign(Object.assign({}, currentRoute), { 
                // TODO fix this typescript exception, it's... complicated
                // @ts-ignore
                routes: (_a = currentRoute.routes) === null || _a === void 0 ? void 0 : _a.concat(newRoute) });
        }
        return Object.assign(Object.assign({}, currentRoute), { routes: (_b = currentRoute.routes) === null || _b === void 0 ? void 0 : _b.map(findAndAdd) });
    }
    function findAndOmitId(currentRoute) {
        var _a;
        return omit(Object.assign(Object.assign({}, currentRoute), { routes: (_a = currentRoute.routes) === null || _a === void 0 ? void 0 : _a.map(findAndOmitId) }), 'id');
    }
    return findAndOmitId(findAndAdd(routeTree));
};
export function findExistingRoute(id, routeTree) {
    var _a;
    return routeTree.id === id ? routeTree : (_a = routeTree.routes) === null || _a === void 0 ? void 0 : _a.find((route) => findExistingRoute(id, route));
}
//# sourceMappingURL=routeTree.js.map