import { type Label } from '../../matchers/types';
import { findRoutingTreeByName } from '../routingTree.utils';

import { useMatchInstancesToSpecificRouteTree } from './useMatchPolicies';
import { useRoutingTrees } from './useRoutingTrees';

export interface RoutingTreePreviewRoute {
  id: string;
  receiver?: string;
}

/** The routes of a tree matching the instances, or `null` when the tree is loading, deleted or failed to load. */
export function useRoutingTreePreview(
  routingTreeName: string | undefined,
  instances: Label[][]
): RoutingTreePreviewRoute[] | null {
  const { trees } = useRoutingTrees();
  const tree = findRoutingTreeByName(trees, routingTreeName) ?? null;
  const match = useMatchInstancesToSpecificRouteTree(tree, instances);

  if (!tree) {
    return null;
  }

  return match ? Array.from(match.matchedPolicies.keys(), ({ id, receiver }) => ({ id, receiver })) : [];
}
