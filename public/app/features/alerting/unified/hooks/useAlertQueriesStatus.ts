import { useEffect, useState } from 'react';

import { getInstanceSettings, isExpressionReference } from '@grafana/runtime';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [allDataSourcesAvailable, setAllDataSourcesAvailable] = useState(false);

  // Derive a stable key from the UIDs so the effect only re-runs when the query set changes,
  // not whenever the caller passes a new array reference with the same content.
  const queriesKey = queries.map((q) => q.datasourceUid).join('\0');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    const dsQueries = queries.filter((query) => !isExpressionReference(query.datasourceUid));
    Promise.all(dsQueries.map((query) => getInstanceSettings(query.datasourceUid)))
      .then((results) => {
        if (!cancelled) {
          setAllDataSourcesAvailable(results.every(Boolean));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setAllDataSourcesAvailable(false);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // queriesKey is the stable dep; queries is read inside but its content is captured correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queriesKey]);

  return { allDataSourcesAvailable, isLoading, error };
}
