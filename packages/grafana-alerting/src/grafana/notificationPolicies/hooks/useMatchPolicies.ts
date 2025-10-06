import { useCallback } from 'react';

import { RoutingTree, alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { USER_DEFINED_TREE_NAME } from '../consts';
import { Route, RouteWithID } from '../types';
import { RouteMatchResult, TreeMatch, convertRoutingTreeToRoute, matchInstancesToRoute } from '../utils';

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
 * @returns An object containing a `matchInstancesToRoutingTrees` function that takes alert instances
 *          and returns an array of InstanceMatchResult objects, each containing the matched routes and matching details
 */
export function useMatchInstancesToRouteTrees() {
  const { data, ...rest } = alertingAPI.endpoints.listRoutingTree.useQuery(
    {},
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const memoizedFunction = useCallback(
    (instances: Label[][]) => matchInstancesToRouteTrees(data?.items ?? [], instances),
    [data?.items]
  );

  return {
    matchInstancesToRouteTrees: memoizedFunction,
    ...rest,
  };
}

/**
 * This function will match a set of labels to multiple routing trees. Assumes a list of routing trees has already been fetched.
 *
 * Use "useMatchInstancesToRouteTrees" if you want the hook to automatically fetch the latest definition of routing trees.
 */
export function matchInstancesToRouteTrees(trees: RoutingTree[], instances: Label[][]): InstanceMatchResult[] {
  // Process each tree and get matches for all instances
  const treeMatches = trees.map<TreeMatch>((tree) => {
    const rootRoute = convertRoutingTreeToRoute(tree);
    return matchInstancesToRoute(rootRoute, instances);
  });

  // Group results by instance
  return instances.map<InstanceMatchResult>((labels) => {
    // Collect matches for this specific instance from all trees
    const allMatchedRoutes = treeMatches.flatMap(({ expandedTree, matchedPolicies }, index) => {
      const tree = trees[index];

      return Array.from(matchedPolicies.entries()).flatMap(([route, results]) =>
        results
          .filter((matchDetails) => matchDetails.labels === labels)
          .map((matchDetails) => ({
            route,
            routeTree: {
              metadata: { name: tree.metadata.name ?? USER_DEFINED_TREE_NAME },
              expandedSpec: expandedTree,
            },
            matchDetails,
          }))
      );
    });

    return {
      labels,
      matchedRoutes: allMatchedRoutes,
    };
  });
}
