import { isArray, merge, pick, reduce } from 'lodash';

import {
  AlertmanagerGroup,
  MatcherOperator,
  ObjectMatcher,
  Route,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { Label, normalizeMatchers } from './matchers';

type OperatorPredicate = (labelValue: string, matcherValue: string) => boolean;

const OperatorFunctions: Record<MatcherOperator, OperatorPredicate> = {
  [MatcherOperator.equal]: (lv, mv) => lv === mv,
  [MatcherOperator.notEqual]: (lv, mv) => lv !== mv,
  [MatcherOperator.regex]: (lv, mv) => Boolean(lv.match(new RegExp(mv))),
  [MatcherOperator.notRegex]: (lv, mv) => !Boolean(lv.match(new RegExp(mv))),
};

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

export interface LabelMatchResult {
  match: boolean;
  matchers: ObjectMatcher[];
}

interface MatchingResult {
  matches: boolean;
  details: Map<ObjectMatcher, Label[]>;
  labelsMatch: Map<Label, LabelMatchResult>;
}

// check if every matcher returns "true" for the set of labels
function matchLabels(matchers: ObjectMatcher[], labels: Label[]): MatchingResult {
  const details = new Map<ObjectMatcher, Label[]>();

  // If a policy has no matchers it still can be a match, hence matchers can be empty and match can be true
  // So we cannot use empty array of matchers as an indicator of no match
  const labelsMatch = new Map<Label, { match: boolean; matchers: ObjectMatcher[] }>(
    labels.map((label) => [label, { match: false, matchers: [] }])
  );

  const matches = matchers.every((matcher) => {
    const matchingLabels = labels.filter((label) => isLabelMatch(matcher, label));

    matchingLabels.forEach((label) => {
      const labelMatch = labelsMatch.get(label);
      // The condition is just to satisfy TS. The map should have all the labels due to the previous map initialization
      if (labelMatch) {
        labelMatch.match = true;
        labelMatch.matchers.push(matcher);
      }
    });

    if (matchingLabels.length === 0) {
      return false;
    }

    details.set(matcher, matchingLabels);
    return matchingLabels.length > 0;
  });

  return { matches, details, labelsMatch };
}

export interface AlertInstanceMatch {
  instance: Labels;
  matchDetails: Map<ObjectMatcher, Labels>;
  labelsMatch: Map<Label, LabelMatchResult>;
}

export interface RouteMatchResult<T extends Route> {
  route: T;
  details: Map<ObjectMatcher, Label[]>;
  labelsMatch: Map<Label, LabelMatchResult>;
}

// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.

// If the current node is not a match, return nothing
// const normalizedMatchers = normalizeMatchers(root);
// Normalization should have happened earlier in the code
function findMatchingRoutes<T extends Route>(
  mainRoot: T,
  labels: Label[]
): { matchesResult: Array<RouteMatchResult<T>>; matchesPath: Array<RouteMatchResult<T>> } {
  // -----------   recursive function to find matching routes
  function findMatchingRoutesRecursive<T extends Route>(
    root: T | undefined,
    labels: Label[],
    matchesPathAcum: Array<RouteMatchResult<T>>
  ): { matchesResult: Array<RouteMatchResult<T>>; matchesPath: Array<RouteMatchResult<T>> } {
    let matches: Array<RouteMatchResult<T>> = [];
    if (!root) {
      return { matchesResult: [], matchesPath: matchesPathAcum };
    }
    // If the current node is not a match, return nothing
    const matchResult: MatchingResult = matchLabels(root.object_matchers ?? [], labels);
    if (!matchResult.matches) {
      return { matchesResult: [], matchesPath: matchesPathAcum };
    }
    // If the current node matches, add current match to the path results and continue with the children
    matchesPathAcum.push({ route: root, details: matchResult.details, labelsMatch: matchResult.labelsMatch });
    if (root.routes) {
      for (let index = 0; index < root.routes.length; index++) {
        let child = root.routes?.[index];
        let { matchesResult: matchingChildren, matchesPath: matchesPathInChild } = findMatchingRoutesRecursive(
          child,
          labels,
          matchesPathAcum
        );
        // TODO how do I solve this typescript thingy? It looks correct to me /shrug
        // @ts-ignore
        matches = matches.concat(matchingChildren);
        // @ts-ignore
        matchingChildren.length && matchesPathAcum.concat(matchesPathInChild);

        // we have matching children and we don't want to continue, so break here
        if (matchingChildren.length && !child?.continue) {
          break;
        }
      }
    }

    // If no child nodes were matches, the current node itself is a match.
    if (matches.length === 0) {
      matches.push({ route: root, details: matchResult.details, labelsMatch: matchResult.labelsMatch });
    }

    const matchesResultUnique = [
      ...new Map(matches.map((matchInstance) => [JSON.stringify(matchInstance), matchInstance])).values(),
    ];
    return { matchesResult: matchesResultUnique, matchesPath: matchesPathAcum };
  }
  // ------------ call to the recursive function
  return findMatchingRoutesRecursive(mainRoot, labels, []);
}

// This is a performance improvement to normalize matchers only once and use the normalized version later on
export function normalizeRoute(rootRoute: RouteWithID): RouteWithID {
  function normalizeRoute(route: RouteWithID) {
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
      const { matchesResult } = findMatchingRoutes(routeTree, labels);
      return matchesResult.some((matchingRoute) => matchingRoute.route === route);
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

export type InhertitableProperties = Pick<
  Route,
  'receiver' | 'group_by' | 'group_wait' | 'group_interval' | 'repeat_interval' | 'mute_time_intervals'
>;

// inherited properties are config properties that exist on the parent route (or its inherited properties) but not on the child route
function getInheritedProperties(
  parentRoute: Route,
  childRoute: Route,
  propertiesParentInherited?: Partial<InhertitableProperties>
) {
  const fullParentProperties = merge({}, parentRoute, propertiesParentInherited);

  const inheritableProperties: InhertitableProperties = pick(fullParentProperties, [
    'receiver',
    'group_by',
    'group_wait',
    'group_interval',
    'repeat_interval',
    'mute_time_intervals',
  ]);

  // TODO how to solve this TypeScript mystery?
  const inherited = reduce(
    inheritableProperties,
    (inheritedProperties: Partial<Route> = {}, parentValue, property) => {
      // @ts-ignore
      const inheritFromParent = parentValue !== undefined && childRoute[property] === undefined;
      const inheritEmptyGroupByFromParent =
        property === 'group_by' && isArray(childRoute[property]) && childRoute[property]?.length === 0;

      if (inheritFromParent) {
        // @ts-ignore
        inheritedProperties[property] = parentValue;
      }

      if (inheritEmptyGroupByFromParent) {
        // @ts-ignore
        inheritedProperties[property] = parentValue;
      }

      return inheritedProperties;
    },
    {}
  );

  return inherited;
}

export { findMatchingAlertGroups, findMatchingRoutes, getInheritedProperties };
