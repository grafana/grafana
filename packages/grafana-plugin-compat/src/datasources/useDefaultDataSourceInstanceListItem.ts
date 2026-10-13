import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDefaultDataSourceInstanceListItem as stableUseDefaultDataSourceInstanceListItem } from '@grafana/runtime';
import { useDefaultDataSourceInstanceListItem as unstableUseDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

import { backwardsCompatibleGetDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface UseDefaultDataSourceInstanceListItemResult {
  isLoading: boolean;
  error?: Error;
  item?: DataSourceInstanceListItem;
}

/**
 * Uses the host hook when available, which also re-resolves on data source cache changes; otherwise
 * resolves synchronously on every render. Picked once at load so the hook order stays stable.
 */
export const useDefaultDataSourceInstanceListItem: (
  items: DataSourceInstanceListItem[]
) => UseDefaultDataSourceInstanceListItemResult =
  typeof stableUseDefaultDataSourceInstanceListItem === 'function'
    ? stableUseDefaultDataSourceInstanceListItem
    : typeof unstableUseDefaultDataSourceInstanceListItem === 'function'
      ? unstableUseDefaultDataSourceInstanceListItem
      : useBackwardsCompatibleDefaultDataSourceInstanceListItem;

function useBackwardsCompatibleDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): UseDefaultDataSourceInstanceListItemResult {
  return { isLoading: false, item: backwardsCompatibleGetDefaultDataSourceInstanceListItem(items) };
}
