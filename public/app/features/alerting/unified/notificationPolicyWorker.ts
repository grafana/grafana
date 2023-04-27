import * as comlink from 'comlink';
import { intersectionBy, isEqual, pick } from 'lodash';

import {
  AlertmanagerGroup,
  Matcher,
  MatcherOperator,
  ObjectMatcher,
  Route,
  RouteWithID,
} from '../../../plugins/datasource/alertmanager/types';

import { findMatchingRoutes } from './utils/notification-policies';

let rootRoute: RouteWithID | undefined = undefined;
let alertGroups: AlertmanagerGroup[] = [];

const npFilterEngine = {
  initData(route: RouteWithID, groups: AlertmanagerGroup[]) {
    rootRoute = route;
    alertGroups = groups;
    // console.log('Root route has been set', rootRoute);
  },

  findMatchingRoute(filters: RouteFilters): string[] {
    console.log('Worker filtering');
    return rootRoute ? findRoutesMatchingFilters(rootRoute, filters).map((r) => r.id) : [];
  },

  findMatchingAlertGroups(route: RouteWithID) {
    return rootRoute ? findMatchingAlertGroups(rootRoute, route, alertGroups) : [];
  },
};

export type FilterEngine = typeof npFilterEngine;

comlink.expose(npFilterEngine);

export interface RouteFilters {
  contactPointFilter?: string;
  labelMatchersFilter?: ObjectMatcher[];
}

const findRoutesMatchingFilters = (rootRoute: RouteWithID, filters: RouteFilters): RouteWithID[] => {
  const { contactPointFilter, labelMatchersFilter = [] } = filters;

  let matchedRoutes: RouteWithID[][] = [];

  const fullRoute = computeInheritedTree(rootRoute);

  const routesMatchingContactPoint = contactPointFilter
    ? findRoutesMatchingPredicate(fullRoute, (route) => route.receiver === contactPointFilter)
    : undefined;

  if (routesMatchingContactPoint) {
    matchedRoutes.push(routesMatchingContactPoint);
  }

  const routesMatchingLabelMatchers = labelMatchersFilter.length
    ? findRoutesMatchingPredicate(fullRoute, (route) => {
        const routeMatchers = normalizeMatchers(route);
        return labelMatchersFilter.every((filter) => routeMatchers.some((matcher) => isEqual(filter, matcher)));
      })
    : undefined;

  if (routesMatchingLabelMatchers) {
    matchedRoutes.push(routesMatchingLabelMatchers);
  }

  return intersectionBy(...matchedRoutes, 'id');
};

type FilterPredicate = (route: RouteWithID) => boolean;

function findRoutesMatchingPredicate(routeTree: RouteWithID, predicateFn: FilterPredicate): RouteWithID[] {
  const matches: RouteWithID[] = [];

  function findMatch(route: RouteWithID) {
    if (predicateFn(route)) {
      matches.push(route);
    }

    route.routes?.forEach(findMatch);
  }

  findMatch(routeTree);
  return matches;
}

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
      return findMatchingRoutes(routeTree, labels).some((matchingRoute) => matchingRoute === route);
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

function computeInheritedTree(routeTree: RouteWithID): RouteWithID {
  return {
    ...routeTree,
    routes: routeTree.routes?.map((route) => {
      const inheritableProperties = pick(routeTree, [
        'receiver',
        'group_by',
        'group_wait',
        'group_interval',
        'repeat_interval',
        'mute_time_intervals',
      ]);

      return computeInheritedTree({
        ...inheritableProperties,
        ...route,
      });
    }),
  };
}

const normalizeMatchers = (route: Route): ObjectMatcher[] => {
  const matchers: ObjectMatcher[] = [];

  if (route.matchers) {
    route.matchers.forEach((matcher) => {
      const { name, value, isEqual, isRegex } = parseMatcher(matcher);
      let operator = MatcherOperator.equal;

      if (isEqual && isRegex) {
        operator = MatcherOperator.regex;
      }
      if (!isEqual && isRegex) {
        operator = MatcherOperator.notRegex;
      }
      if (isEqual && !isRegex) {
        operator = MatcherOperator.equal;
      }
      if (!isEqual && !isRegex) {
        operator = MatcherOperator.notEqual;
      }

      matchers.push([name, operator, value]);
    });
  }

  if (route.object_matchers) {
    matchers.push(...route.object_matchers);
  }

  if (route.match_re) {
    Object.entries(route.match_re).forEach(([label, value]) => {
      matchers.push([label, MatcherOperator.regex, value]);
    });
  }

  if (route.match) {
    Object.entries(route.match).forEach(([label, value]) => {
      matchers.push([label, MatcherOperator.equal, value]);
    });
  }

  return matchers;
};

const matcherOperators = [
  MatcherOperator.regex,
  MatcherOperator.notRegex,
  MatcherOperator.notEqual,
  MatcherOperator.equal,
];

function parseMatcher(matcher: string): Matcher {
  const trimmed = matcher.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    throw new Error(`PromQL matchers not supported yet, sorry! PromQL matcher found: ${trimmed}`);
  }
  const operatorsFound = matcherOperators
    .map((op): [MatcherOperator, number] => [op, trimmed.indexOf(op)])
    .filter(([_, idx]) => idx > -1)
    .sort((a, b) => a[1] - b[1]);

  if (!operatorsFound.length) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }
  const [operator, idx] = operatorsFound[0];
  const name = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + operator.length).trim();
  if (!name) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }

  return {
    name,
    value,
    isRegex: operator === MatcherOperator.regex || operator === MatcherOperator.notRegex,
    isEqual: operator === MatcherOperator.equal || operator === MatcherOperator.regex,
  };
}
