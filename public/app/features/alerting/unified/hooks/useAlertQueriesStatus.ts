import { useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';

import { RuleFormValues } from '../types/rule-form';

export function useAlertQueriesStatus(queries: RuleFormValues['queries']) {
  const allDataSourcesAvailable = useMemo(
    () => queries?.queries?.every((query) => Boolean(getDataSourceSrv().getInstanceSettings(query.datasourceUid))),
    [queries]
  );

  return { allDataSourcesAvailable };
}
