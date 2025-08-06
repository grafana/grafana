import { useCallback } from 'react';

import { RoutingTree, alertingAPI } from '../../api/v0alpha1/api.gen';
import { Label } from '../../matchers/types';
import { Route } from '../types';
import { TreeMatch, matchAlertInstancesToPolicyTree } from '../utils';

export type MatchResult = Array<
  {
    treeMetadata: Pick<RoutingTree['metadata'], 'name'>;
  } & TreeMatch
>;

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
        return [];
      }

      // the routing trees are returned as an array of items because there can be several
      const trees = data.items;

      const matchResult = trees.reduce<MatchResult>((acc, tree) => {
        const treeName = tree.metadata.name ?? 'unknown';

        // construct a pseudo-route from the route tree we get from the API
        // @TODO make type stricter here and remove type assertions
        const rootPolicy = {
          ...tree.spec.defaults,
          routes: tree.spec.routes as Route[],
        } as Route;

        const { expandedTree, matchedPolicies } = matchAlertInstancesToPolicyTree(instances, rootPolicy);

        acc.push({
          treeMetadata: {
            name: treeName,
          },
          expandedTree,
          matchedPolicies,
        });

        return acc;
      }, []);

      return matchResult;
    },
    [data]
  );

  return { matchInstancesToPolicies, ...rest };
}
