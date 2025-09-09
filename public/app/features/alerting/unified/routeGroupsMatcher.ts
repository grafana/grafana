import { InstanceMatchResult, RouteMatch, matchAlertInstancesToPolicyTree } from '@grafana/alerting/unstable';

import { AlertmanagerGroup, RouteWithID } from '../../../plugins/datasource/alertmanager/types';
import { Labels } from '../../../types/unified-alerting-dto';

import { findMatchingAlertGroups, normalizeRoute, unquoteRouteMatchers } from './utils/notification-policies';
import { routeAdapter } from './utils/routeAdapter';

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

    // construct a single tree, external Alertmanagers only support one tree
    const trees = [normalizedRootRoute] as const;

    return instances.map<InstanceMatchResult>((instance) => {
      const labels = Object.entries(instance);
      // Collect all matched routes from all trees
      const allMatchedRoutes: RouteMatch[] = [];

      // Process each tree for this instance
      trees.forEach((tree) => {
        const treeName = 'user-defined';
        // We have to convert the RoutingTree structure to a Route structure to be able to use the matching functions
        const rootRoute = trees[0];

        // Match this single instance against the route tree
        // Convert the RouteWithID to the alerting package format to ensure compatibility
        const convertedRoute = routeAdapter.toPackage(rootRoute);
        const { expandedTree, matchedPolicies } = matchAlertInstancesToPolicyTree([labels], convertedRoute);

        // Process each matched route from the tree
        matchedPolicies.forEach((results, route) => {
          // For each match result, create a RouteMatch object
          results.forEach((matchDetails) => {
            allMatchedRoutes.push({
              route,
              routeTree: {
                metadata: { name: treeName },
                expandedSpec: expandedTree,
              },
              matchDetails,
            });
          });
        });
      });

      return {
        labels,
        matchedRoutes: allMatchedRoutes,
      };
    });
  },
};

function getNormalizedRoute(route: RouteWithID, options?: MatchOptions): RouteWithID {
  return options?.unquoteMatchers ? unquoteRouteMatchers(normalizeRoute(route)) : normalizeRoute(route);
}

export type RouteGroupsMatcher = typeof routeGroupsMatcher;
