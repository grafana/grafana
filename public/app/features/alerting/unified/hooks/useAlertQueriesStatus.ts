import { useAsync } from 'react-use';

import { getInstanceSettings, isExpressionReference } from '@grafana/runtime';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  const { loading, value, error } = useAsync(async () => {
    const dsQueries = queries.filter((query) => !isExpressionReference(query.datasourceUid));
    const results = await Promise.all(dsQueries.map((query) => getInstanceSettings(query.datasourceUid)));
    return results.every(Boolean);
  }, [queries]);

  return { allDataSourcesAvailable: value ?? false, isLoading: loading, error };
}
