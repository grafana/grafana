import { DateTime, isDateTime, TimeRange } from '@grafana/data';

import { LokiQueryType } from '../types';

/**
 * This function compares two time values. If the first is absolute, it compares them using `DateTime.isSame`.
 *
 * @param {(DateTime | string)} time1
 * @param {(DateTime | string | undefined)} time2
 */
function compareTime(time1: DateTime | string | undefined, time2: DateTime | string | undefined) {
  if (!time1 || !time2) {
    return false;
  }

  const isAbsolute = isDateTime(time1);

  if (isAbsolute) {
    return time1.isSame(time2);
  }

  return time1 === time2;
}

export function shouldUpdateStats(
  query: string,
  prevQuery: string | undefined,
  timeRange: TimeRange | undefined,
  prevTimeRange: TimeRange | undefined,
  queryType: LokiQueryType | undefined,
  prevQueryType: LokiQueryType | undefined
): boolean {
  if (prevQuery === undefined || query.trim() !== prevQuery.trim() || queryType !== prevQueryType) {
    return true;
  }

  if (
    compareTime(timeRange?.raw.from, prevTimeRange?.raw.from) &&
    compareTime(timeRange?.raw.to, prevTimeRange?.raw.to)
  ) {
    return false;
  }

  return true;
}
