import { useEffect, useState } from 'react';

import { getInstanceSettings, isExpressionReference } from '@grafana/runtime';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  const [allDataSourcesAvailable, setAllDataSourcesAvailable] = useState(true);

  useEffect(() => {
    const dsQueries = queries.filter((query) => !isExpressionReference(query.datasourceUid));
    Promise.all(dsQueries.map((query) => getInstanceSettings(query.datasourceUid))).then((results) => {
      setAllDataSourcesAvailable(results.every(Boolean));
    });
  }, [queries]);

  return { allDataSourcesAvailable };
}
