import * as comlink from 'comlink';
import { cloneDeep } from 'lodash';

import {
  AlertmanagerGroup,
  Matcher,
  MatcherOperator,
  ObjectMatcher,
  Route,
  RouteWithID,
} from '../../../plugins/datasource/alertmanager/types';

const npFilterEngine = {
  getRouteGroupsMap(rootRoute: RouteWithID, groups: AlertmanagerGroup[]): Map<string, AlertmanagerGroup[]> {
    const normalizedRootRoute = normalizeRootRoute(rootRoute);

    function addRouteGroups(route: NormalizedRoute, acc: Map<string, AlertmanagerGroup[]>) {
      const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
      acc.set(route.id, routeGroups);

      route.routes?.forEach((r) => addRouteGroups(r, acc));
    }

    const routeGroupsMap = new Map<string, AlertmanagerGroup[]>();
    addRouteGroups(normalizedRootRoute, routeGroupsMap);

    return routeGroupsMap;
  },
};

export type FilterEngine = typeof npFilterEngine;

comlink.expose(npFilterEngine);

export interface RouteFilters {
  contactPointFilter?: string;
  labelMatchersFilter?: ObjectMatcher[];
}

type NormalizedRoute = Omit<RouteWithID, 'matchers' | 'match' | 'match_re'> & { routes?: NormalizedRoute[] };
// This is a performance improvement to normalize matchers only once and use the normalized version later on
function normalizeRootRoute(rootRoute: RouteWithID): NormalizedRoute {
  function normalizeRoute(route: RouteWithID) {
    route.object_matchers = normalizeMatchers(route);
    delete route.matchers;
    delete route.match;
    delete route.match_re;
    route.routes?.forEach(normalizeRoute);
  }

  const normalizedRootRoute = cloneDeep(rootRoute);
  normalizeRoute(normalizedRootRoute);

  return normalizedRootRoute;
}

function findMatchingAlertGroups(
  routeTree: NormalizedRoute,
  route: NormalizedRoute,
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

function findMatchingRoutes<T extends Route>(root: T, labels: Label[]): T[] {
  let matches: T[] = [];

  // If the current node is not a match, return nothing
  // const normalizedMatchers = normalizeMatchers(root);
  // Normalization should have happened earlier in the code
  if (!root.object_matchers || !matchLabels(root.object_matchers, labels)) {
    return [];
  }

  // If the current node matches, recurse through child nodes
  if (root.routes) {
    for (let index = 0; index < root.routes.length; index++) {
      let child = root.routes[index];
      let matchingChildren = findMatchingRoutes(child, labels);

      // TODO how do I solve this typescript thingy? It looks correct to me /shrug
      // @ts-ignore
      matches = matches.concat(matchingChildren);

      // we have matching children and we don't want to continue, so break here
      if (matchingChildren.length && !child.continue) {
        break;
      }
    }
  }

  // If no child nodes were matches, the current node itself is a match.
  if (matches.length === 0) {
    matches.push(root);
  }

  return matches;
}

function matchLabels(matchers: ObjectMatcher[], labels: Label[]) {
  return matchers.every((matcher) => {
    return labels.some((label) => isLabelMatch(matcher, label));
  });
}

function isLabelMatch(matcher: ObjectMatcher, label: Label) {
  const [labelKey, labelValue] = label;
  const [matcherKey, operator, matcherValue] = matcher;

  // not interested, keys don't match
  if (labelKey !== matcherKey) {
    return false;
  }

  const matchFunction = OperatorFunctions[operator];
  if (!matchFunction) {
    throw new Error(`no such operator: ${operator}`);
  }

  return matchFunction(labelValue, matcherValue);
}

type Label = [string, string];
type OperatorPredicate = (labelValue: string, matcherValue: string) => boolean;

const OperatorFunctions: Record<MatcherOperator, OperatorPredicate> = {
  [MatcherOperator.equal]: (lv, mv) => lv === mv,
  [MatcherOperator.notEqual]: (lv, mv) => lv !== mv,
  [MatcherOperator.regex]: (lv, mv) => Boolean(lv.match(new RegExp(mv))),
  [MatcherOperator.notRegex]: (lv, mv) => !Boolean(lv.match(new RegExp(mv))),
};
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
