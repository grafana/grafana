import {
  type RoutingTree,
  generatedAPI as notificationsAPIv1beta1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

// Kept at module level so the value stays referentially stable while the list is still loading,
// and callers can safely put it in a dependency array.
const NO_TREES: RoutingTree[] = [];

type UseRoutingTreesResult = ReturnType<typeof notificationsAPIv1beta1.useListRoutingTreeQuery> & {
  /** Shortcut for `currentData.items`. Empty while loading or when the request failed. */
  trees: RoutingTree[];
};

/**
 * Fetches all notification policy trees for a picker. Refetches on mount and on window focus so the
 * list picks up trees created in another tab. Pass `trees` to buildRoutingTreeOptions to get
 * combobox options.
 */
export function useRoutingTrees(): UseRoutingTreesResult {
  const result = notificationsAPIv1beta1.useListRoutingTreeQuery(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  return { ...result, trees: result.currentData?.items ?? NO_TREES };
}
