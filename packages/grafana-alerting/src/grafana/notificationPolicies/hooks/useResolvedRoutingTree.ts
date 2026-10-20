import { useMemo } from 'react';

import { findRoutingTreeByName } from '../routingTree.utils';
import { type RoutingTreeView, toRoutingTreeView } from '../routingTreeView';

import { useRoutingTrees } from './useRoutingTrees';

export interface ResolvedRoutingTree {
  /** The tree named `name`, or `null` while loading, when none matches, or when the list failed to load. */
  tree: RoutingTreeView | null;
  /** The list hasn't loaded yet, so `tree === null` doesn't mean "missing". */
  isResolving: boolean;
  /** The list loaded and no tree has the name - e.g. the tree was deleted. */
  isNotFound: boolean;
  /** The list failed to load and there is no earlier result to fall back on. */
  isError: boolean;
}

/** Looks a tree up by name, telling "still loading", "doesn't exist" and "failed to load" apart so callers
 * never fall back to the default policy for a tree they couldn't confirm. An unset name is the default tree. */
export function useResolvedRoutingTree(name?: string): ResolvedRoutingTree {
  const { trees, currentData, isError } = useRoutingTrees();

  const found = findRoutingTreeByName(trees, name);
  const tree = useMemo(() => (found ? toRoutingTreeView(found) : null), [found]);
  const isResolving = !currentData && !isError;
  const isNotFound = Boolean(currentData) && !found;

  // A refetch that fails keeps the last good list; that list is still a valid answer.
  return { tree, isResolving, isNotFound, isError: isError && !currentData };
}
