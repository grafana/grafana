import { findMatchingRoutes } from '@grafana/alerting';
import { AlertmanagerGroup, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { normalizeMatchers, unquoteWithUnescape } from './matchers';
import { routeAdapter } from './routeAdapter';

// This is a performance improvement to normalize matchers only once and use the normalized version later on
export function normalizeRoute<T extends Route>(rootRoute: T): T {
  function normalizeRoute<T extends Route>(route: T) {
    route.object_matchers = normalizeMatchers(route);
    delete route.matchers;
    delete route.match;
    delete route.match_re;
    route.routes?.forEach(normalizeRoute);
  }

  const normalizedRootRoute = structuredClone(rootRoute);
  normalizeRoute(normalizedRootRoute);

  return normalizedRootRoute;
}

export function unquoteRouteMatchers<T extends Route>(route: T): T {
  function unquoteRoute(route: Route) {
    route.object_matchers = route.object_matchers?.map(([name, operator, value]) => {
      return [unquoteWithUnescape(name), operator, unquoteWithUnescape(value)];
    });
    route.routes?.forEach(unquoteRoute);
  }

  const unwrappedRootRoute = structuredClone(route);
  unquoteRoute(unwrappedRootRoute);

  return unwrappedRootRoute;
}

/**
 * find all of the groups that have instances that match the route, thay way we can find all instances
 * (and their grouping) for the given route
 */
function findMatchingAlertGroups(
  routeTree: RouteWithID,
  route: RouteWithID,
  alertGroups: AlertmanagerGroup[]
): AlertmanagerGroup[] {
  const matchingGroups: AlertmanagerGroup[] = [];

  // Convert routes once outside the loop for efficiency
  // findMatchingRoutes expects the alerting package Route type, so we need to convert
  const alertingRouteTree = routeAdapter.toPackage(routeTree);
  const alertingRoute = routeAdapter.toPackage(route);

  return alertGroups.reduce((acc, group) => {
    // find matching alerts in the current group
    const matchingAlerts = group.alerts.filter((alert) => {
      const labels = Object.entries(alert.labels);
      const matchingRoutes = findMatchingRoutes(alertingRouteTree, labels);

      // Compare routes by id - we must use ID comparison because routeAdapter.toPackage()
      // creates new objects, so reference equality would always be false.
      // The ID is preserved during conversion and uniquely identifies each route.
      return matchingRoutes.some((matchingRoute) => matchingRoute.route.id === alertingRoute.id);
    });

    // if the groups has any alerts left after matching, add it to the results
    if (matchingAlerts.length) {
      acc.push({
        ...group,
        alerts: matchingAlerts,
      });
    }

    return acc;
  }, matchingGroups);
}

// recursive function to rename receivers in all routes (notification policies)
function renameReceiverInRoute(route: Route, oldName: string, newName: string) {
  const updated: Route = {
    ...route,
  };

  if (updated.receiver === oldName) {
    updated.receiver = newName;
  }

  if (updated.routes) {
    updated.routes = updated.routes.map((route) => renameReceiverInRoute(route, oldName, newName));
  }

  return updated;
}

export { findMatchingAlertGroups, renameReceiverInRoute };
