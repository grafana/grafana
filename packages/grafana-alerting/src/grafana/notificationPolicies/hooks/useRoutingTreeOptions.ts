import { useMemo } from 'react';

import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { getRoutingTreeDisplayName, isDefaultRoutingTreeName } from '../routingTrees';

import { useListRoutingTrees } from './useRoutingTrees';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

// Kept at module level so the value stays referentially stable while the list is still loading,
// and callers can safely put it in a dependency array.
const NO_TREES: RoutingTree[] = [];

/**
 * Turns routing trees into combobox options: the default tree is labelled "Default policy" and
 * always listed first, the rest are sorted by name.
 */
export function buildRoutingTreeOptions(trees: RoutingTree[]): Array<ComboboxOption<string>> {
  return trees
    .map((tree) => {
      const name = tree.metadata.name ?? '';

      return {
        label: getRoutingTreeDisplayName(name),
        value: name,
        description: isDefaultRoutingTreeName(name)
          ? t('alerting.routing-trees.default-policy-desc', 'Routes alerts using the default notification policy tree')
          : t('alerting.routing-trees.custom-policy-desc', 'Route alerts through the {{name}} policy tree', { name }),
      } satisfies ComboboxOption<string>;
    })
    .sort((a, b) => {
      // Default policy always first
      if (isDefaultRoutingTreeName(a.value)) {
        return -1;
      }
      if (isDefaultRoutingTreeName(b.value)) {
        return 1;
      }
      return collator.compare(a.label, b.label);
    });
}

interface UseRoutingTreeOptionsResult {
  /** The trees as combobox options, default policy first. */
  options: Array<ComboboxOption<string>>;
  /** The trees themselves, for handing the selected tree back to a caller. */
  trees: RoutingTree[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Fetches the notification policy trees and returns them both as combobox options and as the raw
 * trees, so a picker can render the list and still resolve a selection back to a tree.
 */
export function useRoutingTreeOptions(): UseRoutingTreeOptionsResult {
  const { currentData, isLoading, isError } = useListRoutingTrees(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  const trees = currentData?.items;
  const options = useMemo(() => buildRoutingTreeOptions(trees ?? NO_TREES), [trees]);

  return { options, trees: trees ?? NO_TREES, isLoading, isError };
}
