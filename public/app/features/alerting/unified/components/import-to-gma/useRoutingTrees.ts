import { useMemo } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import { notificationsAPI } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';

const { useListRoutingTreeQuery } = notificationsAPI;
interface RoutingTreeOption {
  /** The actual routing tree name (used as value) */
  name: string;
  /** The display label for the dropdown */
  label: string;
}

interface UseRoutingTreesResult {
  /** List of routing tree options with name and label */
  routingTrees: RoutingTreeOption[];
  /** Whether the query is loading */
  isLoading: boolean;
  /** Error if the query failed */
  error?: unknown;
}

/**
 * Returns the display label for a routing tree name.
 * Uses "Default Policy" for the root route, otherwise returns the actual name.
 */
export function getRoutingTreeLabel(name: string): string {
  if (isDefaultRoutingTreeName(name)) {
    return t('alerting.import-to-gma.routing-tree.default-policy', 'Default Policy');
  }
  return name;
}

/**
 * Hook to fetch the list of routing trees from the k8s API.
 * Returns options with name (value) and label (display) for use in dropdowns.
 */
export function useRoutingTrees(): UseRoutingTreesResult {
  const { data, isLoading, error } = useListRoutingTreeQuery({});

  const routingTrees = useMemo(() => {
    if (!data?.items) {
      return [];
    }
    // Extract names from the routing trees and create options with display labels
    return data.items
      .map((item) => item.metadata?.name)
      .filter((name): name is string => !!name)
      .map((name) => ({
        name,
        label: getRoutingTreeLabel(name),
      }));
  }, [data]);

  return {
    routingTrees,
    isLoading,
    error,
  };
}
