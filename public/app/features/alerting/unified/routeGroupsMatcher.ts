import { InstanceMatchResult, matchInstancesToRoute } from '@grafana/alerting/unstable';

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
    const normalizedRootRoute: RouteWithID = getNormalizedRoute(rootRoute, options);

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
    const normalizedRouteTree = getNormalizedRoute(routeTree, options);

    // Convert all instances to labels format and match them all at once
    const allLabels = instances.map((instance) => Object.entries(instance));

    // Convert the RouteWithID to the alerting package format to ensure compatibility
    const convertedRoute = routeAdapter.toPackage(normalizedRouteTree);
    const { expandedTree, matchedPolicies } = matchInstancesToRoute(convertedRoute, allLabels);

    // Group results by instance
    return instances.map<InstanceMatchResult>((instance, index) => {
      const labels = allLabels[index];

      // Collect matches for this specific instance
      const allMatchedRoutes = Array.from(matchedPolicies.entries()).flatMap(([route, results]) =>
        results
          .filter((matchDetails) => matchDetails.labels === labels)
          .map((matchDetails) => ({
            route,
            routeTree: {
              metadata: { name: 'user-defined' },
              expandedSpec: expandedTree,
            },
            matchDetails,
          }))
      );

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
