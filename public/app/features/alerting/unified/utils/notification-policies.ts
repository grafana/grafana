import { AlertmanagerGroup, MatcherOperator, ObjectMatcher, Route } from 'app/plugins/datasource/alertmanager/types';

import { normalizeMatchers } from './amroutes';

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

// check if every matcher returns "true" for the set of labels
function matchLabels(matchers: ObjectMatcher[], labels: Label[]) {
  return matchers.every((matcher) => {
    return labels.some((label) => isLabelMatch(matcher, label));
  });
}

// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.
function findMatchingRoutes<T extends Route>(root: T, labels: Label[]): T[] {
  let matches: T[] = [];

  // If the current node is not a match, return nothing
  const normalizedMatchers = normalizeMatchers(root);
  if (!matchLabels(normalizedMatchers, labels)) {
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

export { findMatchingAlertGroups, findMatchingRoutes, matchLabels };
