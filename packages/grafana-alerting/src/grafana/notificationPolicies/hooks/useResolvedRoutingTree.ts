import { type RoutingTree } from '../../api/notifications';
import { findRoutingTreeByName } from '../routingTree.utils';

import { useRoutingTrees } from './useRoutingTrees';

export interface ResolvedRoutingTree {
  /** The tree named `name`, or `null` when no name is given or none matches. */
  tree: RoutingTree | null;
  /** A name was given but the list hasn't loaded yet, so `tree === null` doesn't mean "missing". */
  isResolving: boolean;
  /** A name was given, the list loaded, and no tree has it - e.g. the tree was deleted. */
  isNotFound: boolean;
  isError: boolean;
}

/** Looks a routing tree up by name, telling apart "still loading", "doesn't exist" and "failed to load"
 * so callers don't fall back to the default policy for a tree they merely couldn't confirm yet. */
export function useResolvedRoutingTree(name?: string): ResolvedRoutingTree {
  const { trees, currentData, isError } = useRoutingTrees();

  const tree = name ? (findRoutingTreeByName(trees, name) ?? null) : null;
  const isResolving = Boolean(name) && !currentData && !isError;
  const isNotFound = Boolean(name) && Boolean(currentData) && !tree;

  return { tree, isResolving, isNotFound, isError };
}
