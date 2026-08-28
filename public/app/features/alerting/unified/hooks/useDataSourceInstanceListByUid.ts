import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

export function useDataSourceInstanceListByUid(): ReadonlyMap<string, DataSourceInstanceListItem> {
  const { items } = useDataSourceInstanceList({ all: true });
  return useMemo(() => new Map(items.map((item) => [item.uid, item])), [items]);
}
