import {
  RouteWithID as AlertingRouteWithID,
  type LabelMatcher,
  findMatchingRoutes,
  getInheritedProperties,
} from '@grafana/alerting/unstable';
import { AlertmanagerGroup, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import {
  convertObjectMatcherToAlertingPackageMatcher,
  matcherToObjectMatcher,
  normalizeMatchers,
  parseMatcherToArray,
  unquoteWithUnescape,
} from './matchers';

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
  routeTree: Route,
  route: Route,
  alertGroups: AlertmanagerGroup[]
): AlertmanagerGroup[] {
  const matchingGroups: AlertmanagerGroup[] = [];

  return alertGroups.reduce((acc, group) => {
    // find matching alerts in the current group
    const matchingAlerts = group.alerts.filter((alert) => {
      const labels = Object.entries(alert.labels);
      return findMatchingRoutes(routeTree, labels).some((matchingRoute) => matchingRoute.route === route);
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

/**
 * Converts a RouteWithID from the alertmanager types to the alerting package RouteWithID format.
 * This handles the conversion between different matcher formats.
 */
function convertRouteWithIDToAlertingFormat(route: RouteWithID): AlertingRouteWithID {
  let matchers: LabelMatcher[] = [];

  if (route.object_matchers) {
    matchers = route.object_matchers.map(convertObjectMatcherToAlertingPackageMatcher);
  } else if (route.matchers) {
    route.matchers.forEach((matcher) => {
      const parsedMatchers = parseMatcherToArray(matcher)
        .map(matcherToObjectMatcher)
        .map(convertObjectMatcherToAlertingPackageMatcher);
      matchers.push(...parsedMatchers);
    });
  }

  const convertedRoute: AlertingRouteWithID = {
    ...route,
    receiver: route.receiver ?? undefined,
    continue: route.continue ?? false,
    matchers,
    routes: route.routes ? route.routes.map(convertRouteWithIDToAlertingFormat) : [],
  };

  return convertedRoute;
}

export {
  findMatchingAlertGroups,
  findMatchingRoutes,
  getInheritedProperties,
  renameReceiverInRoute,
  convertRouteWithIDToAlertingFormat,
};
