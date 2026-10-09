/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import {
  type GetDataSourceListFilters,
  getDataSourceSrv,
  getDataSourceInstanceList as stableGetDataSourceInstanceList,
} from '@grafana/runtime';
import {
  type GetDataSourceInstanceListFilters,
  getDataSourceInstanceList as unstableGetDataSourceInstanceList,
} from '@grafana/runtime/unstable';

export async function getDataSourceInstanceList(
  filters?: GetDataSourceInstanceListFilters
): Promise<DataSourceInstanceListItem[]> {
  if (typeof stableGetDataSourceInstanceList === 'function') {
    return stableGetDataSourceInstanceList(filters);
  }

  if (typeof unstableGetDataSourceInstanceList === 'function') {
    return unstableGetDataSourceInstanceList(filters);
  }

  return backwardsCompatibleGetDataSourceInstanceList(filters);
}

async function backwardsCompatibleGetDataSourceInstanceList(
  filters?: GetDataSourceInstanceListFilters
): Promise<DataSourceInstanceListItem[]> {
  const { filter, ...rest } = filters ?? {};
  const legacyFilters: GetDataSourceListFilters = filter
    ? { ...rest, filter: (item) => filter(toDataSourceInstanceListItem(item)) }
    : { ...rest };

  return getDataSourceSrv().getList(legacyFilters).map(toDataSourceInstanceListItem);
}

function toDataSourceInstanceListItem(item: DataSourceInstanceSettings): DataSourceInstanceListItem {
  return {
    meta: { ...item.meta },
    name: item.name,
    type: item.type,
    uid: item.uid,
    apiVersion: item.apiVersion,
  };
}
