import { useMemo } from 'react';

import { type Label } from '../../matchers/types';

import { useMatchInstancesToSpecificRouteTree } from './useMatchPolicies';
import { useRoutingTreeLookup } from './useResolvedRoutingTree';

export interface NotificationPolicyPreviewResult {
  /** Anything but `found` means the tree couldn't be confirmed, so `routes` is empty and shouldn't be read as "no match". */
  status: 'resolving' | 'notFound' | 'error' | 'found';
  /** The tree's routes matching the instances. When `status` is `found`, empty means nothing matched. */
  routes: Array<{ id: string; receiver?: string }>;
}

const NO_ROUTES: NotificationPolicyPreviewResult['routes'] = [];

/** Previews the routes of a tree that match the instances. An unset name previews the default tree. */
export function useNotificationPolicyPreview(
  routingTreeName: string | undefined,
  instances: Label[][]
): NotificationPolicyPreviewResult {
  const { found, isResolving, isError } = useRoutingTreeLookup(routingTreeName);
  // Expanding a large tree is costly, so don't match until there is something to match.
  const match = useMatchInstancesToSpecificRouteTree(instances.length > 0 ? (found ?? null) : null, instances);
  const routes = useMemo(
    () => (match ? Array.from(match.matchedPolicies.keys(), ({ id, receiver }) => ({ id, receiver })) : NO_ROUTES),
    [match]
  );

  if (isError) {
    return { status: 'error', routes: NO_ROUTES };
  }
  if (isResolving) {
    return { status: 'resolving', routes: NO_ROUTES };
  }
  if (!found) {
    return { status: 'notFound', routes: NO_ROUTES };
  }

  return { status: 'found', routes };
}
