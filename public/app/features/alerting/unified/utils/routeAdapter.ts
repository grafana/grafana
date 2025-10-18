import {
  Route as AlertingRoute,
  RouteWithID as AlertingRouteWithID,
  type LabelMatcher,
} from '@grafana/alerting/unstable';

import {
  MatcherOperator,
  type ObjectMatcher,
  type Route,
  type RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';

import { convertObjectMatcherToAlertingPackageMatcher, matcherToObjectMatcher, parseMatcherToArray } from './matchers';

/**
 * Enhanced type guards using infer-based utility types
 */
function hasId<T extends Route | RouteWithID>(route: T): route is T & RouteWithID {
  return 'id' in route && typeof route.id === 'string';
}

function hasAlertingId<T extends AlertingRoute | AlertingRouteWithID>(route: T): route is T & AlertingRouteWithID {
  return 'id' in route && typeof route.id === 'string';
}

/**
 * Converts from package route format to alertmanager route format
 */
function fromPackageRoute(route: AlertingRouteWithID): RouteWithID;
function fromPackageRoute(route: AlertingRoute): Route;
function fromPackageRoute(route: AlertingRoute | AlertingRouteWithID): Route | RouteWithID {
  // Convert matchers from LabelMatcher[] to ObjectMatcher[]
  const object_matchers = route.matchers?.map(labelMatcherToObjectMatcher);

  // Recursively convert child routes
  const routes = route.routes?.length ? route.routes.map(fromPackageRoute) : undefined;

  const baseRoute = {
    receiver: route.receiver || null,
    group_by: route.group_by,
    continue: route.continue,
    group_wait: route.group_wait,
    group_interval: route.group_interval,
    repeat_interval: route.repeat_interval,
    mute_time_intervals: route.mute_time_intervals,
    active_time_intervals: route.active_time_intervals,
  };

  const convertedRoute = {
    ...baseRoute,
    object_matchers,
    routes,
  };

  // If the input route has an ID, include it in the output
  if (hasAlertingId(route)) {
    return {
      ...convertedRoute,
      id: route.id,
    };
  }

  return convertedRoute;
}

/**
 * Converts from alertmanager route format to package route format
 */
function toPackageRoute(route: RouteWithID): AlertingRouteWithID;
function toPackageRoute(route: Route): AlertingRoute;
function toPackageRoute(route: Route | RouteWithID): AlertingRoute | AlertingRouteWithID {
  // Convert matchers
  let matchers: LabelMatcher[] = [];

  if (route.object_matchers) {
    matchers = route.object_matchers.map(convertObjectMatcherToAlertingPackageMatcher);
  } else if (route.matchers) {
    matchers = [];
    route.matchers.forEach((matcher) => {
      const parsedMatchers = parseMatcherToArray(matcher)
        .map(matcherToObjectMatcher)
        .map(convertObjectMatcherToAlertingPackageMatcher);
      matchers.push(...parsedMatchers);
    });
  }

  // Recursively convert child routes
  const routes = route.routes?.length ? route.routes.map(toPackageRoute) : [];

  const baseRoute = {
    receiver: route.receiver ?? undefined,
    group_by: route.group_by,
    continue: route.continue ?? false,
    group_wait: route.group_wait,
    group_interval: route.group_interval,
    repeat_interval: route.repeat_interval,
    mute_time_intervals: route.mute_time_intervals,
    active_time_intervals: route.active_time_intervals,
  };

  const convertedRoute = {
    ...baseRoute,
    matchers,
    routes,
  };

  // If the input route has an ID, include it in the output
  if (hasId(route)) {
    return {
      ...convertedRoute,
      id: route.id,
    };
  }

  return convertedRoute;
}

/**
 * Converts routes between alertmanager and package formats
 */
export const routeAdapter = {
  /**
   * Converts from package route format to alertmanager route format
   * Handles both Route and RouteWithID variants
   */
  fromPackage: fromPackageRoute,

  /**
   * Converts from alertmanager route format to package route format
   * Handles both Route and RouteWithID variants
   */
  toPackage: toPackageRoute,
};

/**
 * Safely converts a LabelMatcher type to MatcherOperator
 */
function convertToMatcherOperator(type: LabelMatcher['type']): MatcherOperator {
  switch (type) {
    case '=':
      return MatcherOperator.equal;
    case '!=':
      return MatcherOperator.notEqual;
    case '=~':
      return MatcherOperator.regex;
    case '!~':
      return MatcherOperator.notRegex;
    default:
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown matcher type: ${exhaustiveCheck}`);
  }
}

/**
 * Converts a LabelMatcher from the alerting package format to an ObjectMatcher for alertmanager format
 */
export function labelMatcherToObjectMatcher(matcher: LabelMatcher): ObjectMatcher {
  return [matcher.label, convertToMatcherOperator(matcher.type), matcher.value];
}
