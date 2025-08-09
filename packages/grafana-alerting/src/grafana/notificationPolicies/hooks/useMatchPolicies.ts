import { useCallback } from 'react';

import { RoutingTree, alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { Route } from '../types';
import { RouteMatchResult, RouteWithID, matchAlertInstancesToPolicyTree } from '../utils';

export type RouteMatch = {
  policy: Route;
  policyTree: {
    /* add some metadata about the tree that is useful for displaying diagnostics */
    metadata: Pick<RoutingTree['metadata'], 'name'>;
    /* we'll include the entire expanded policy tree for diagnostics */
    expandedSpec: RouteWithID;
  };
  matchDetails: RouteMatchResult<RouteWithID>;
};

export type InstanceMatchResult = {
  /* the labels we used to match to our policies */
  labels: Label[];
  /* the routes that matched the labels where the key is a route and the value is an array of instances that match that route */
  matchedPolicies: RouteMatch[];
};

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

  const matchInstancesToPolicies = useCallback(
    (instances: Label[][]): InstanceMatchResult[] => {
      if (!data) {
        return [];
      }

      // the routing trees are returned as an array of items because there can be several
      const trees = data.items;

      return instances.map<InstanceMatchResult>((labels) => {
        // Array to collect all matched policies from all trees
        const allMatchedPolicies: RouteMatch[] = [];

        // Process all trees for this instance
        trees.forEach((tree) => {
          const treeName = tree.metadata.name ?? 'user-defined';

          // construct a pseudo-route from the route tree we get from the API
          // @TODO maybe a function to convert RoutingTree to a Route?
          const rootPolicy = {
            ...tree.spec.defaults,
            routes: tree.spec.routes as Route[],
          } as Route;

          // Match this single instance against the policy tree
          const { expandedTree, matchedPolicies } = matchAlertInstancesToPolicyTree([labels], rootPolicy);

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
          labels,
          matchedPolicies: allMatchedPolicies,
        };
      });
    },
    [data]
  );

  return { matchInstancesToPolicies, ...rest };
}
