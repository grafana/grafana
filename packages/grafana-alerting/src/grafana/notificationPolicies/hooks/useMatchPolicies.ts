import { useCallback } from 'react';

import { alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { Route } from '../types';
import { RouteMatchResult, computeInheritedTree, findMatchingRoutes } from '../utils';

type TreeMatch = {
  tree: Route;
  matches: Set<RouteMatchResult<Route>>; // the route that matched the labels
};

/**
 * React hook that finds notification policy routes in all routing trees that match the provided labels.
 *
 * This hook queries the routing tree API and processes each tree to:
 * 1. Compute the inherited properties for each node in the tree
 * 2. Find routes within each tree that match the given set of labels
 *
 * @param labels - An array of label objects to match against routes in the routing trees
 * @returns An array of matching routes for each routing tree, where each element contains
 *          the matching routes and information about how they matched the provided labels
 */
export function useMatchLabelsToNotificationPolicy(labels: Label[]) {
  // fetch the routing trees from the API
  const { data, refetch, ...rest } = alertingAPI.endpoints.listRoutingTree.useQuery({});

  const matchLabels = useCallback((): Set<TreeMatch> => {
    refetch();

    if (!data) {
      return new Set();
    }

    // prepare the intial results, by default there won't be any matches for each tree
    const result = new Set<TreeMatch>(
      data.items.map((tree) => ({
        // @TODO I hate to type-cast here but RoutingTreeSpec.Routes is not compatible with Route because we've narrowed the types for label matchers :(
        // @ts-expect-error
        tree: computeInheritedTree(tree.spec as Route),
        matches: new Set(),
      }))
    );

    // for each tree, find matching routes for the provided instances
    result.forEach(({ tree, matches }) => {
      const matchingRoutes = findMatchingRoutes(tree, labels);
      matchingRoutes.forEach((match) => {
        matches.add(match);
      });
    });

    return result;
  }, [data, labels, refetch]);

  return { matchLabels, ...rest };
}
