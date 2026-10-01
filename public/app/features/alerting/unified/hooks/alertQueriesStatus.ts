import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export type AlertQueryDataSources = Map<string, DataSourceInstanceListItem>;

function referencedUids(queries: AlertQuery[]): string[] {
  return queries.filter((query) => !isExpressionReference(query.datasourceUid)).map((query) => query.datasourceUid);
}

/** Resolves the data sources referenced by `queries`, keyed by uid. */
export function useAlertQueryDataSources(queries: AlertQuery[]) {
  // `all: true` because we only need the uids to resolve, not any particular capability.
  const { items, isLoading, error } = useDataSourceInstanceList({ all: true });

  const uids = referencedUids(queries);
  const uidKey = JSON.stringify(uids);

  const dataSourcesByUid: AlertQueryDataSources = useMemo(() => {
    const referenced = new Set(uids);
    return new Map(items.filter((item) => referenced.has(item.uid)).map((item) => [item.uid, item]));
    // Keyed on the serialized uids rather than `uids` itself: callers pass a new array every render,
    // and a rebuild filters the whole instance list. JSON, not join, so a uid containing the
    // separator can't collide with two shorter ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, uidKey]);

  // With nothing referenced there is nothing to resolve, so don't report the list's state as ours.
  const hasReferences = uids.length > 0;

  return {
    dataSourcesByUid,
    isLoading: hasReferences && isLoading,
    error: hasReferences ? error : undefined,
  };
}

/** Whether every non-expression query in `queries` resolved to a data source. */
export function getAlertQueriesStatus(queries: AlertQuery[], dataSourcesByUid: AlertQueryDataSources) {
  const allDataSourcesAvailable = referencedUids(queries).every((uid) => dataSourcesByUid.has(uid));

  return { allDataSourcesAvailable };
}
