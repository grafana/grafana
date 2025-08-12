import { isArray, pick, reduce } from 'lodash';

import { RouteWithID as AlertingRouteWithID, LabelMatcher } from '@grafana/alerting/unstable';
import { AlertmanagerGroup, ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { Label, convertObjectMatcherToAlertingPackageMatcher, isLabelMatch, matchLabelsSet, matcherToObjectMatcher, normalizeMatchers, parseMatcherToArray, unquoteWithUnescape } from './matchers';

// If a policy has no matchers it still can be a match, hence matchers can be empty and match can be true
// So we cannot use null as an indicator of no match
interface LabelMatchResult {
  match: boolean;
  matcher: ObjectMatcher | null;
}

export const INHERITABLE_KEYS = ['receiver', 'group_by', 'group_wait', 'group_interval', 'repeat_interval'] as const;
export type InheritableKeys = typeof INHERITABLE_KEYS;
export type InheritableProperties = Pick<Route, InheritableKeys[number]>;

type LabelsMatch = Map<Label, LabelMatchResult>;

interface MatchingResult {
  matches: boolean;
  labelsMatch: LabelsMatch;
}

// returns a match results for given set of matchers (from a policy for instance) and a set of labels
export function matchLabels(matchers: ObjectMatcher[], labels: Label[]): MatchingResult {
  const matches = matchLabelsSet(matchers, labels);

  // create initial map of label => match result
  const labelsMatch: LabelsMatch = new Map(labels.map((label) => [label, { match: false, matcher: null }]));

  // for each matcher, check which label it matched for
  matchers.forEach((matcher) => {
    const matchingLabel = labels.find((label) => isLabelMatch(matcher, label));

    // record that matcher for the label
    if (matchingLabel) {
      labelsMatch.set(matchingLabel, {
        match: true,
        matcher,
      });
    }
  });

  return { matches, labelsMatch };
}

export interface AlertInstanceMatch {
  instance: Labels;
  labelsMatch: LabelsMatch;
}

export interface RouteMatchResult<T extends Route> {
  route: T;
  labelsMatch: LabelsMatch;
}

// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.

// If the current node is not a match, return nothing
// Normalization should have happened earlier in the code
function findMatchingRoutes<T extends Route>(route: T, labels: Label[]): Array<RouteMatchResult<T>> {
  let childMatches: Array<RouteMatchResult<T>> = [];

  // If the current node is not a match, return nothing
  const matchResult = matchLabels(route.object_matchers ?? [], labels);
  if (!matchResult.matches) {
    return [];
  }

  // If the current node matches, recurse through child nodes
  if (route.routes) {
    for (const child of route.routes) {
      const matchingChildren = findMatchingRoutes(child, labels);
      // TODO how do I solve this typescript thingy? It looks correct to me /shrug
      // @ts-ignore
      childMatches = childMatches.concat(matchingChildren);
      // we have matching children and we don't want to continue, so break here
      if (matchingChildren.length && !child.continue) {
        break;
      }
    }
  }

  // If no child nodes were matches, the current node itself is a match.
  if (childMatches.length === 0) {
    childMatches.push({ route, labelsMatch: matchResult.labelsMatch });
  }

  return childMatches;
}

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

// inherited properties are config properties that exist on the parent route (or its inherited properties) but not on the child route
function getInheritedProperties(
  parentRoute: Route,
  childRoute: Route,
  propertiesParentInherited?: InheritableProperties
): InheritableProperties {
  const propsFromParent: InheritableProperties = pick(parentRoute, INHERITABLE_KEYS);
  const inheritableProperties: InheritableProperties = {
    ...propsFromParent,
    ...propertiesParentInherited,
  };

  const inherited = reduce(
    inheritableProperties,
    (inheritedProperties: InheritableProperties, parentValue, property) => {
      const parentHasValue = parentValue != null;

      const inheritableValues = [undefined, '', null];
      // @ts-ignore
      const childIsInheriting = inheritableValues.some((value) => childRoute[property] === value);
      const inheritFromValue = childIsInheriting && parentHasValue;

      const inheritEmptyGroupByFromParent =
        property === 'group_by' &&
        parentHasValue &&
        isArray(childRoute[property]) &&
        childRoute[property]?.length === 0;

      const inheritFromParent = inheritFromValue || inheritEmptyGroupByFromParent;

      if (inheritFromParent) {
        // @ts-ignore
        inheritedProperties[property] = parentValue;
      }

      return inheritedProperties;
    },
    {}
  );

  return inherited;
}

/**
 * This function will compute the full tree with inherited properties – this is mostly used for search and filtering
 */
export function computeInheritedTree<T extends Route>(parent: T): T {
  return {
    ...parent,
    routes: parent.routes?.map((child) => {
      const inheritedProperties = getInheritedProperties(parent, child);

      return computeInheritedTree({
        ...child,
        ...inheritedProperties,
      });
    }),
  };
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
      const parsedMatchers = parseMatcherToArray(matcher).map(matcherToObjectMatcher).map(convertObjectMatcherToAlertingPackageMatcher);
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


export { findMatchingAlertGroups, findMatchingRoutes, getInheritedProperties, renameReceiverInRoute, convertRouteWithIDToAlertingFormat };
