import { type RoutingTree, type RoutingTreeRoute } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

/** Every policy across the routing trees: each tree's default policy plus all nested policies. */
export function countNotificationPolicies(trees: RoutingTree[]): number {
  const countRoutes = (routes: RoutingTreeRoute[] = []): number =>
    routes.reduce((sum, route) => sum + 1 + countRoutes(route.routes), 0);

  return trees.reduce((sum, tree) => sum + 1 + countRoutes(tree.spec.routes), 0);
}
