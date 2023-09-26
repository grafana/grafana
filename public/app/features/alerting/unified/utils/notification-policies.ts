import { isArray, merge, pick, reduce } from 'lodash';

import {
  AlertmanagerGroup,
  MatcherOperator,
  ObjectMatcher,
  Route,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { normalizeMatchers } from './matchers';

export type Label = [string, string];

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

interface LabelMatchResult {
  match: boolean;
  matchers: ObjectMatcher[];
}

interface MatchingResult {
  matches: boolean;
  details: Map<ObjectMatcher, Label[]>;
  labelsMatch: Map<Label, LabelMatchResult>;
}

function isMissingLabelMatcher(matcher: ObjectMatcher): boolean {
  return (
    (matcher[1] === MatcherOperator.equal && matcher[2] === '') ||
    (matcher[1] === MatcherOperator.regex && matcher[2] !== '^$') ||
    (matcher[1] === MatcherOperator.notRegex && matcher[2] === '.*')
  );
}

function isNotEmptyValueInMissingLabel(key: string, label: Label): boolean {
  return key === label[0] && label[1] !== '';
}
// check if every matcher returns "true" for the set of labels
function matchLabels(matchersInNotificationPolicy: ObjectMatcher[], labelsInInstance: Label[]): MatchingResult {
  const details = new Map<ObjectMatcher, Label[]>();
  let matchesEmpty = false;
  // If a policy has no matchers it still can be a match, hence matchers can be empty and match can be true
  // So we cannot use empty array of matchers as an indicator of no match
  const labelsMatch = new Map<Label, { match: boolean; matchers: ObjectMatcher[] }>(
    labelsInInstance.map((label) => [label, { match: false, matchers: [] }])
  );

  // WE HAVE TO MATCH ALL MATCHERS
  const matches = matchersInNotificationPolicy.every((matcher) => {
    const matchingLabelsInInstance = labelsInInstance.filter((label) => isLabelMatch(matcher, label));

    // update the map with the matchers and the match
    matchingLabelsInInstance.forEach((label) => {
      //for each label that matches a matcher, we update the map with the matchers and the match
      const labelMatch = labelsMatch.get(label);
      // The condition is just to satisfy TS. The map should have all the labels due to the previous map initialization
      if (labelMatch) {
        labelMatch.match = true;
        labelMatch.matchers.push(matcher);
      }
    });

    if (matchingLabelsInInstance.length === 0) {
      //NO MATCH FOR THIS MATCHER, BUT MAYBE IT'S A MISSING LABEL MATCHER
      if (!isMissingLabelMatcher(matcher)) {
        return false;
      }
      // check if there is no other matcher for the same label key in labelsMatch
      if (labelsInInstance.some((label) => isNotEmptyValueInMissingLabel(matcher[0], label))) {
        return false;
      }
      let labelMatch: {
        match: boolean;
        matchers: ObjectMatcher[];
      };

      labelMatch = { match: true, matchers: [matcher] };
      labelMatch.matchers.push(matcher);
      matchesEmpty = true;
      labelsMatch.set([matcher[0], ''], labelMatch);
      return true;
    }

    details.set(matcher, matchingLabelsInInstance);
    return matchingLabelsInInstance.length > 0 || matchesEmpty;
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
function findMatchingRoutes<T extends Route>(root: T, labels: Label[]): Array<RouteMatchResult<T>> {
  let matches: Array<RouteMatchResult<T>> = [];

  // If the current node is not a match, return nothing
  const matchResult = matchLabels(root.object_matchers ?? [], labels);
  if (!matchResult.matches) {
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
    matches.push({ route: root, details: matchResult.details, labelsMatch: matchResult.labelsMatch });
  }

  return matches;
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
      const parentHasValue = parentValue !== undefined;

      // @ts-ignore
      const inheritFromParentUndefined = parentHasValue && childRoute[property] === undefined;
      // @ts-ignore
      const inheritFromParentEmptyString = parentHasValue && childRoute[property] === '';

      const inheritEmptyGroupByFromParent =
        property === 'group_by' &&
        parentHasValue &&
        isArray(childRoute[property]) &&
        childRoute[property]?.length === 0;

      const inheritFromParent =
        inheritFromParentUndefined || inheritFromParentEmptyString || inheritEmptyGroupByFromParent;

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

export { findMatchingAlertGroups, findMatchingRoutes, getInheritedProperties };
