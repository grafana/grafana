import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

/** The data sources referenced by a set of alert queries, keyed by uid. */
export type AlertQueryDataSources = Map<string, DataSourceInstanceListItem>;

function referencedUids(queries: AlertQuery[]): string[] {
  return queries.filter((query) => !isExpressionReference(query.datasourceUid)).map((query) => query.datasourceUid);
}

/**
 * Resolve the data sources referenced by `queries`, keyed by uid. Expression references are
 * skipped — they are not real data sources.
 */
export function useAlertQueryDataSources(queries: AlertQuery[]) {
  // `all: true` so resolution isn't gated by plugin capability flags (metrics/logs/etc.) —
  // we only care whether a uid resolves, not what the data source can do.
  const { items, isLoading, error } = useDataSourceInstanceList({ all: true });

  const uids = referencedUids(queries);
  const uidKey = uids.join(',');

  const dataSourcesByUid: AlertQueryDataSources = useMemo(() => {
    const referenced = new Set(uids);
    return new Map(items.filter((item) => referenced.has(item.uid)).map((item) => [item.uid, item]));
    // `uids` is left out of the deps on purpose: `uidKey` is its stable serialization, so the map is
    // only rebuilt when the referenced uids actually change. Callers may pass a new queries array on
    // every render (e.g. react-hook-form's watch in PreviewRule), which would otherwise rebuild it
    // — and the filter is over every data source in the instance list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, uidKey]);

  return { dataSourcesByUid, isLoading, error };
}

/** Whether every non-expression query in `queries` resolved to a data source. */
export function getAlertQueriesStatus(queries: AlertQuery[], dataSourcesByUid: AlertQueryDataSources) {
  const allDataSourcesAvailable = referencedUids(queries).every((uid) => dataSourcesByUid.has(uid));

  return { allDataSourcesAvailable };
}
