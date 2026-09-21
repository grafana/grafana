import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDefaultDataSourceInstanceListItem as rtGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

/**
 * Resolve the item flagged as the default data source, or `undefined` when the list holds none.
 *
 * At most one instance per org carries the flag, so a filtered list need not contain it.
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
  return items.find((item) => item?.isDefault);
}
