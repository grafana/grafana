import { RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

export const USER_DEFINED_TREE_NAME = 'user-defined';

/**
 * Check if the given routing tree is the default (user-defined) policy tree.
 *
 */
export function isDefaultRoutingTree(tree: RoutingTree): boolean {
  return tree.metadata.name === USER_DEFINED_TREE_NAME;
}
