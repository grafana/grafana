import { useMemo } from 'react';

import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  // `all: true` so availability isn't gated by plugin capability flags (metrics/logs/etc.) —
  // we only care whether the uid exists, not what the datasource can do.
  const { items, isLoading, error } = useDataSourceInstanceList({ all: true });

  const allDataSourcesAvailable = useMemo(() => {
    const availableUids = new Set(items.map((ds) => ds.uid));
    return queries
      .filter((query) => !isExpressionReference(query.datasourceUid))
      .every((query) => availableUids.has(query.datasourceUid));
  }, [items, queries]);

  return { allDataSourcesAvailable, isLoading, error };
}
