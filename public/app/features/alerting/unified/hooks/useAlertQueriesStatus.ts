import { useMemo } from 'react';

import { getDataSourceSrv, isExpressionReference } from '@grafana/runtime';
import { AlertQuery } from 'app/types/unified-alerting-dto';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  const allDataSourcesAvailable = useMemo(
    () =>
      queries
        .filter((query) => !isExpressionReference(query.datasourceUid))
        .every((query) => {
          const instanceSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
          return Boolean(instanceSettings);
        }),
    [queries]
  );

  return { allDataSourcesAvailable };
}
