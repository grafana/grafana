import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

/** The name the backend emits for the default (root) routing tree and the name the frontend SENDS. */
export const USER_DEFINED_TREE_NAME = 'user-defined';

/** Future canonical name the backend may emit for the default (root) routing tree; accepted on the read side. */
export const DEFAULT_ROUTING_TREE_NAME_ALIAS = 'default';

/**
 * Reports whether a routing-tree name refers to the default (root) routing tree.
 *
 * Accepts both the emitted name (`user-defined`) and the future canonical alias (`default`), mirroring the
 * backend's IsDefaultRoutingTreeName. Also treats an absent name (empty string / undefined) as the default,
 * because the frontend uses "no name" to mean the root route.
 */
export function isDefaultRoutingTreeName(name?: string): boolean {
  return (
    name === undefined || name === '' || name === USER_DEFINED_TREE_NAME || name === DEFAULT_ROUTING_TREE_NAME_ALIAS
  );
}

/**
 * Check if the given routing tree is the default (root) policy tree.
 */
export function isDefaultRoutingTree(tree: RoutingTree): boolean {
  return isDefaultRoutingTreeName(tree.metadata.name);
}
