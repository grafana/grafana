import { TimeRange } from '@grafana/data';

import { LokiDatasource } from '../datasource';
import { QueryStats } from '../types';

export async function getStats(datasource: LokiDatasource, query: string): Promise<QueryStats | undefined> {
  if (!query) {
    return undefined;
  }

  const response = await datasource.getQueryStats(query);
  return Object.values(response).every((v) => v === 0) ? undefined : response;
}

export function shouldUpdateStats(
  query: string,
  prevQuery: string | undefined,
  timerange: TimeRange,
  prevTimerange: TimeRange | undefined
): boolean {
  if (query === prevQuery && timerange.from.isSame(prevTimerange?.from) && timerange.to.isSame(prevTimerange?.to)) {
    return false;
  }

  return true;
}
