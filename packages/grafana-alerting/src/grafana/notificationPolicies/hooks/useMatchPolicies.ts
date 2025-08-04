import { groupBy } from 'lodash';
import { useCallback } from 'react';

import { alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { Route } from '../types';
import { RouteMatchResult, RouteWithID, addUniqueIdentifier, computeInheritedTree, findMatchingRoutes } from '../utils';

type TreeMatch = {
  expandedTree: RouteWithID;
  matchedPolicies: Map<string, Array<RouteMatchResult<RouteWithID>>>; // the route that matched the labels
};
type MatchResult = Map<string, TreeMatch>;

/**
 * React hook that finds notification policy routes in all routing trees that match the provided set of alert instances.
 *
 * This hook queries the routing tree API and processes each tree to:
 * 1. Compute the inherited properties for each node in the tree
 * 2. Find routes within each tree that match the given set of labels
 *
 * @returns An array of matching routes for each routing tree, where each element contains
 *          the matching routes and information about how they matched the provided labels
 */
export function useMatchAlertInstancesToNotificationPolicies() {
  // fetch the routing trees from the API
  const { data, ...rest } = alertingAPI.endpoints.listRoutingTree.useQuery(
    {},
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  // @TODO do we really need this to be a separate function?
  const matchInstancesToPolicies = useCallback(
    (instances: Label[][]): MatchResult => {
      if (!data) {
        return new Map();
      }

      // the routing trees are returned as an array of items
      const trees = data.items;

      // prepare the intial results, by default there won't be any matches for each tree
      const matchResult = trees.reduce<MatchResult>((acc, tree) => {
        const treeName = tree.metadata.name ?? 'unknown';

        // compute the entire expanded tree for matching routes and diagnostics
        // this will include inherited properties from parent nodes
        // @TODO I don't like the type cast here :(
        const expandedTree = addUniqueIdentifier(
          computeInheritedTree({
            ...(tree.spec.defaults as Route),
            routes: tree.spec.routes as Route[],
          })
        );

        // initially empty map of matches policies
        const matchedPolicies = new Map();

        acc.set(treeName, {
          expandedTree,
          matchedPolicies,
        });

        return acc;
      }, new Map());

      // for each tree, find matching routes for the provided instances
      matchResult.forEach(({ expandedTree, matchedPolicies }) => {
        // let's first find all matching routes for the provided instances
        const matchesArray = instances.flatMap((labels) => findMatchingRoutes(expandedTree, labels));

        // now group the matches by route ID
        // this will give us a map of route IDs to their matching instances
        // we use the route ID as the key to ensure uniqueness
        // and to allow for easy lookup later
        const groupedByRoute = groupBy(matchesArray, (match) => match.route.id);
        Object.entries(groupedByRoute).forEach(([key, match]) => {
          matchedPolicies.set(key, match);
        });
      });

      return matchResult;
    },
    [data]
  );

  return { matchInstancesToPolicies, ...rest };
}
