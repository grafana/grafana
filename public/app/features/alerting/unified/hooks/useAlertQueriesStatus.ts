import { useMemo } from 'react';

import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  // `all: true` so availability isn't gated by plugin capability flags (metrics/logs/etc.) —
  // we only care whether the uid exists, not what the datasource can do.
  const { items, isLoading, error } = useDataSourceInstanceList({ all: true });

  // Keyed on `items` only: building the set is the part worth memoizing, and callers may pass a
  // new `queries` array on every render (e.g. react-hook-form's watch in PreviewRule), which
  // would otherwise rebuild the set each time.
  const availableUids = useMemo(() => new Set(items.map((ds) => ds.uid)), [items]);

  const allDataSourcesAvailable = queries
    .filter((query) => !isExpressionReference(query.datasourceUid))
    .every((query) => availableUids.has(query.datasourceUid));

  return { allDataSourcesAvailable, isLoading, error };
}
