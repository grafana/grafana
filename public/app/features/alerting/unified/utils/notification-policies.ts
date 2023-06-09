import { isArray, merge, pick, reduce } from 'lodash';

import { AlertmanagerGroup, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { Label, normalizeMatchers, labelsMatchObjectMatchers } from './matchers';

// Match does a depth-first left-to-right search through the route tree
// and returns the matching routing nodes.
function findMatchingRoutes(root: Route, labels: Label[]): Route[] {
  const matches: Route[] = [];

  // If the current node is not a match, return nothing
  // const normalizedMatchers = normalizeMatchers(root);
  // Normalization should have happened earlier in the code
  if (!root.object_matchers || !labelsMatchObjectMatchers(root.object_matchers, labels)) {
    return [];
  }

  // If the current node matches, recurse through child nodes
  if (root.routes) {
    for (const child of root.routes) {
      const matchingChildren = findMatchingRoutes(child, labels);

      matches.push(...matchingChildren);

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
