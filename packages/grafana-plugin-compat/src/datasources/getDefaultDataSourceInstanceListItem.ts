import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDefaultDataSourceInstanceListItem as rtGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

/**
 * Resolve which item of a data source list should be treated as the default: the one flagged
 * `isDefault`, otherwise the first item, or `undefined` when nothing is eligible.
 *
 * Built-ins (`-- Grafana --`, `-- Mixed --`, `-- Dashboard --`) are never eligible: they are
 * never flagged, and `getDataSourceInstanceList` appends them regardless of a `type` filter.
 */
export function getDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): DataSourceInstanceListItem | undefined {
  if (typeof rtGetDefaultDataSourceInstanceListItem === 'function') {
    return rtGetDefaultDataSourceInstanceListItem(items);
  }

  return backwardsCompatibleGetDefaultDataSourceInstanceListItem(items);
}

function backwardsCompatibleGetDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): DataSourceInstanceListItem | undefined {
  // Drop nullish entries up front so the first-item fallback cannot return one.
  const candidates = items.filter((item) => item != null && !item.meta?.builtIn);
  return candidates.find((item) => item.isDefault) ?? candidates[0];
}
