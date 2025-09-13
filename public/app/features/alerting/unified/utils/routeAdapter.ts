import {
  Route as AlertingRoute,
  RouteWithID as AlertingRouteWithID,
  type LabelMatcher,
} from '@grafana/alerting/unstable';
import { MatcherOperator, ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { convertObjectMatcherToAlertingPackageMatcher, matcherToObjectMatcher, parseMatcherToArray } from './matchers';

/**
 * type aliases to help us convert Route and RouteWithID types
 */
type MapToPackageRoute<T> = T extends RouteWithID ? AlertingRouteWithID : T extends Route ? AlertingRoute : never;
type MapFromPackageRoute<T> = T extends AlertingRouteWithID ? RouteWithID : T extends AlertingRoute ? Route : never;

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
function fromPackageRoute<T extends AlertingRoute | AlertingRouteWithID>(route: T): MapFromPackageRoute<T> {
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
    const routeWithId = {
      ...convertedRoute,
      id: route.id,
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return routeWithId as MapFromPackageRoute<T>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return convertedRoute as MapFromPackageRoute<T>;
}

/**
 * Converts from alertmanager route format to package route format
 */
function toPackageRoute<T extends Route | RouteWithID>(route: T): MapToPackageRoute<T> {
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
    const routeWithId = {
      ...convertedRoute,
      id: route.id,
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return routeWithId as MapToPackageRoute<T>;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return convertedRoute as MapToPackageRoute<T>;
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
 * Converts a LabelMatcher from the alerting package format to an ObjectMatcher for alertmanager format
 */
export function labelMatcherToObjectMatcher(matcher: LabelMatcher): ObjectMatcher {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return [matcher.label, matcher.type as MatcherOperator, matcher.value];
}
