import { type RoutingTree } from '../../api/notifications';
import { findRoutingTreeByName } from '../routingTree.utils';

import { useRoutingTrees } from './useRoutingTrees';

export interface ResolvedRoutingTree {
  /** The tree named `name`, or `null` while loading, when none matches, or when the list failed to load. */
  tree: RoutingTree | null;
  /** The list hasn't loaded yet, so `tree === null` doesn't mean "missing". */
  isResolving: boolean;
  /** The list loaded and no tree has the name - e.g. the tree was deleted. */
  isNotFound: boolean;
  /** The list failed to load and there is no earlier result to fall back on. */
  isError: boolean;
}

/** Looks a routing tree up by name, telling apart "still loading", "doesn't exist" and "failed to load"
 * so callers don't fall back to the default policy for a tree they merely couldn't confirm yet.
 * An unset or default name resolves the default tree, like `findRoutingTreeByName`. */
export function useResolvedRoutingTree(name?: string): ResolvedRoutingTree {
  const { trees, currentData, isError } = useRoutingTrees();

  const tree = findRoutingTreeByName(trees, name) ?? null;
  const isResolving = !currentData && !isError;
  const isNotFound = Boolean(currentData) && !tree;

  // A refetch that fails keeps the last good list; that list is still a valid answer.
  return { tree, isResolving, isNotFound, isError: isError && !currentData };
}
