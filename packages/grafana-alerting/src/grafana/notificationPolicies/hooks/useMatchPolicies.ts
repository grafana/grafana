import { useCallback } from 'react';

import { RoutingTree, notificationsAPI } from '../../api/notifications/v0alpha1/notifications.api.gen';
import { Label } from '../../matchers/types';
import { USER_DEFINED_TREE_NAME } from '../consts';
import { Route, RouteWithID } from '../types';
import { RouteMatchResult, convertRoutingTreeToRoute, matchAlertInstancesToPolicyTree } from '../utils';

export type RouteMatch = {
  route: Route;
  routeTree: {
    // Add some metadata about the tree that is useful for displaying diagnostics
    metadata: Pick<RoutingTree['metadata'], 'name'>;
    // We'll include the entire expanded policy tree for diagnostics
    expandedSpec: RouteWithID;
  };
  matchDetails: RouteMatchResult<RouteWithID>;
};

export type InstanceMatchResult = {
  // The labels we used to match to our policies
  labels: Label[];
  // The routes that matched the labels where the key is a route and the value is an array of instances that match that route
  matchedRoutes: RouteMatch[];
};

/**
 * React hook that finds notification policy routes in all routing trees that match the provided set of alert instances.
 *
 * This hook queries the routing tree API and processes each tree to:
 * 1. Convert RoutingTree structures to Route structures
 * 2. Compute the inherited properties for each node in the tree
 * 3. Find routes within each tree that match the given set of labels
 *
 * @returns An object containing a `matchInstancesToPolicies` function that takes alert instances
 *          and returns an array of InstanceMatchResult objects, each containing the matched routes and matching details
 */
export function useMatchAlertInstancesToNotificationPolicies() {
  // fetch the routing trees from the API
  const { data, ...rest } = notificationsAPI.endpoints.listRoutingTree.useQuery(
    {},
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const matchInstancesToPolicies = useCallback(
    (instances: Label[][]): InstanceMatchResult[] => {
      if (!data) {
        return [];
      }

      // the routing trees are returned as an array of items because there can be several
      const trees = data.items;

      return instances.map<InstanceMatchResult>((labels) => {
        // Collect all matched routes from all trees
        const allMatchedRoutes: RouteMatch[] = [];

        // Process each tree for this instance
        trees.forEach((tree) => {
          const treeName = tree.metadata.name ?? USER_DEFINED_TREE_NAME;
          // We have to convert the RoutingTree structure to a Route structure to be able to use the matching functions
          const rootRoute = convertRoutingTreeToRoute(tree);

          // Match this single instance against the route tree
          const { expandedTree, matchedPolicies } = matchAlertInstancesToPolicyTree([labels], rootRoute);

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
    [data]
  );

  return { matchInstancesToPolicies, ...rest };
}
