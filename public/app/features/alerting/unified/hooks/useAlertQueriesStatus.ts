import { useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
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
