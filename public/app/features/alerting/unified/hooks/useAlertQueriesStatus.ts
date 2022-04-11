import { getDataSourceSrv } from '@grafana/runtime';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import { useMemo } from 'react';

export function useAlertQueriesStatus(queries: AlertQuery[]) {
  const allDataSourcesAvailable = useMemo(
    () => queries.every((query) => Boolean(getDataSourceSrv().getInstanceSettings(query.datasourceUid))),
    [queries]
  );

  return { allDataSourcesAvailable };
}
