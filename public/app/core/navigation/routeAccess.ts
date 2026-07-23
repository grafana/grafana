/**
 * Adapts a page-access predicate (as used by the nav tree's `when` gates) to
 * RouteDescriptor.roles, so one access definition drives both nav visibility
 * and the route guard. GrafanaRouteWrapper redirects home when the returned
 * list contains no role the user holds; 'Reject' matches nothing, mirroring
 * contextSrv.evaluatePermission's deny idiom.
 */
export const routeAccess = (hasAccess: () => boolean) => (): string[] => (hasAccess() ? [] : ['Reject']);
