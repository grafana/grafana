import { AdHocVariableFilter, RawTimeRange, Scope } from '@grafana/data';
import { PromResponse } from 'app/types/unified-alerting-dto';

import { callSuggestionsApi } from '../utils';

export async function getMetricNames(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  limit?: number
): Promise<PromResponse<string[]>> {
  const response = await callSuggestionsApi(
    dataSourceUid,
    timeRange,
    scopes,
    filters,
    '__name__',
    limit,
    'explore-metrics-names'
  );

  return response.data;
}
