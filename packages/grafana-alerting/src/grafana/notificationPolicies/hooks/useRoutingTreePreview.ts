import { type Label } from '../../matchers/types';
import { type RouteWithID } from '../types';

import { useMatchInstancesToSpecificRouteTree } from './useMatchPolicies';
import { useResolvedRoutingTree } from './useResolvedRoutingTree';

/**
 * The routes of a tree that match the given instances, or `null` when there is nothing to show: the tree is
 * still loading, was deleted or failed to load.
 */
export function useRoutingTreePreview(routingTreeName: string | undefined, instances: Label[][]): RouteWithID[] | null {
  const { tree } = useResolvedRoutingTree(routingTreeName);
  const match = useMatchInstancesToSpecificRouteTree(tree, instances);

  if (!tree) {
    return null;
  }

  return match ? Array.from(match.matchedPolicies.keys()) : [];
}
