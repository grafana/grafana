import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

export interface DataSourceInstanceListByUidResult {
  byUid: ReadonlyMap<string, DataSourceInstanceListItem>;
  isLoading: boolean;
  error?: Error;
}

export function useDataSourceInstanceListByUid(): DataSourceInstanceListByUidResult {
  const { items, isLoading, error } = useDataSourceInstanceList({ all: true });
  const byUid = useMemo(() => new Map(items.map((item) => [item.uid, item])), [items]);
  return { byUid, isLoading, error };
}
