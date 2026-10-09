/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { getDefaultDataSourceInstanceListItem as rtGetDefaultDataSourceInstanceListItem } from '@grafana/runtime/unstable';

/**
 * Resolve the item whose data source is the org default, or `undefined` when the list holds none.
 *
 * At most one instance per org carries the flag, so a filtered list need not contain it.
 */
export async function getDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): Promise<DataSourceInstanceListItem | undefined> {
  if (typeof rtGetDefaultDataSourceInstanceListItem === 'function') {
    return rtGetDefaultDataSourceInstanceListItem(items);
  }

  return backwardsCompatibleGetDefaultDataSourceInstanceListItem(items);
}

export function backwardsCompatibleGetDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): DataSourceInstanceListItem | undefined {
  return items.find((item) => item && getDataSourceSrv().getInstanceSettings(item.uid)?.isDefault);
}
