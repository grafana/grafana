import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';

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

/**
 * Finds the routing tree with the given name, treating every alias for the default tree as the
 * same thing: "", undefined, "user-defined" and "default" all resolve to whichever default tree
 * the backend actually returned. Use this instead of matching `metadata.name` yourself, so a
 * caller that stores the default tree under a different alias still finds it.
 */
export function findRoutingTreeByName(trees: RoutingTree[], name?: string): RoutingTree | undefined {
  if (isDefaultRoutingTreeName(name)) {
    return trees.find(isDefaultRoutingTree);
  }
  return trees.find((tree) => tree.metadata.name === name);
}

/**
 * The name to show a user for a routing tree. The default tree gets a friendly label instead of
 * its raw backend name; every other tree is shown as-is.
 */
export function getRoutingTreeDisplayName(name?: string): string {
  if (isDefaultRoutingTreeName(name)) {
    return t('alerting.routing-trees.default-policy', 'Default policy');
  }
  // isDefaultRoutingTreeName already covered the empty cases, so a name is guaranteed here.
  return name ?? '';
}
