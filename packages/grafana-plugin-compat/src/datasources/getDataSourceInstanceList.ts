/* eslint-disable @grafana/no-get-data-source-srv */
import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { type GetDataSourceListFilters, getDataSourceSrv } from '@grafana/runtime';
import {
  type GetDataSourceInstanceListFilters,
  getDataSourceInstanceList as rtGetDataSourceInstanceList,
} from '@grafana/runtime/unstable';

type Filters = GetDataSourceInstanceListFilters;

export function getDataSourceInstanceList(filters?: Filters): Promise<DataSourceInstanceListItem[]> {
  if (typeof rtGetDataSourceInstanceList === 'function') {
    return rtGetDataSourceInstanceList(filters);
  }

  return backwardsCompatibleGetDataSourceInstanceList(filters);
}

function backwardsCompatibleGetDataSourceInstanceList(filters?: Filters): Promise<DataSourceInstanceListItem[]> {
  const { filter, ...rest } = filters ?? {};
  const legacyFilters: GetDataSourceListFilters = filter
    ? { ...rest, filter: (item) => filter(toDataSourceInstanceListItem(item)) }
    : { ...rest };

  const list = getDataSourceSrv().getList(legacyFilters).map(toDataSourceInstanceListItem);
  return Promise.resolve(list);
}

function toDataSourceInstanceListItem(item: DataSourceInstanceSettings): DataSourceInstanceListItem {
  return {
    isDefault: item.isDefault ?? false,
    meta: { ...item.meta },
    name: item.name,
    type: item.type,
    uid: item.uid,
    apiVersion: item.apiVersion,
  };
}
