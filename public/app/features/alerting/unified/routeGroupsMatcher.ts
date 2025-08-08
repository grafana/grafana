import { InstanceMatchResult, Route, RouteMatch, matchAlertInstancesToPolicyTree } from '@grafana/alerting/unstable';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import { findMatchingAlertGroups, normalizeRoute, unquoteRouteMatchers } from './utils/notification-policies';

export interface MatchOptions {
  unquoteMatchers?: boolean;
}

export const routeGroupsMatcher = {
  getRouteGroupsMap(
    rootRoute: RouteWithID,
    groups: AlertmanagerGroup[],
    options?: MatchOptions
  ): Map<string, AlertmanagerGroup[]> {
    const normalizedRootRoute = getNormalizedRoute(rootRoute, options);

    function addRouteGroups(route: RouteWithID, acc: Map<string, AlertmanagerGroup[]>) {
      const routeGroups = findMatchingAlertGroups(normalizedRootRoute, route, groups);
      acc.set(route.id, routeGroups);

      route.routes?.forEach((r) => addRouteGroups(r, acc));
    }

    const routeGroupsMap = new Map<string, AlertmanagerGroup[]>();
    addRouteGroups(normalizedRootRoute, routeGroupsMap);

    return routeGroupsMap;
  },

  matchInstancesToRoutes(routeTree: RouteWithID, instances: Labels[], options?: MatchOptions): InstanceMatchResult[] {
    const normalizedRootRoute = getNormalizedRoute(routeTree, options);

    // the routing trees are returned as an array of items because there can be several
    const trees = [normalizedRootRoute];

    return instances.map<InstanceMatchResult>((labels) => {
      // Array to collect all matched policies from all trees
      const allMatchedPolicies: RouteMatch[] = [];
      const labelsArray = Object.entries(labels);

      // Process all trees for this instance
      trees.forEach((rootPolicy) => {
        const treeName = 'user-defined';

        // Match this single instance against the policy tree
        // @TODO make sure we update the "matchers" to be compatible with the data structure from the Alerting package
        const { expandedTree, matchedPolicies } = matchAlertInstancesToPolicyTree([labelsArray], rootPolicy as Route);

        // Process each matched policy from the tree
        matchedPolicies.forEach((results, policy) => {
          // For each match result, create a RouteMatch object
          results.forEach((matchDetails) => {
            allMatchedPolicies.push({
              policy,
              policyTree: {
                metadata: { name: treeName },
                expandedSpec: expandedTree,
              },
              matchDetails,
            });
          });
        });
      });

      return {
        labels: labelsArray,
        matchedPolicies: allMatchedPolicies,
      };
    });
  },
};

function getNormalizedRoute(route: RouteWithID, options?: MatchOptions): RouteWithID {
  return options?.unquoteMatchers ? unquoteRouteMatchers(normalizeRoute(route)) : normalizeRoute(route);
}

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
