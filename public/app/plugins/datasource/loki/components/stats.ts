import { DateTime, isDateTime, TimeRange } from '@grafana/data';

import { LokiQueryType } from '../types';

/**
 * This function compares two time values. If the first is absolute, it compares them using `DateTime.isSame`.
 *
 * @param {(DateTime | string)} time1
 * @param {(DateTime | string | undefined)} time2
 */
function compareTime(time1: DateTime | string, time2: DateTime | string | undefined) {
  const isAbsolute = isDateTime(time1);

  if (isAbsolute) {
    return time1.isSame(time2);
  }

  return time1 === time2;
}

export function shouldUpdateStats(
  query: string,
  prevQuery: string | undefined,
  timerange: TimeRange,
  prevTimerange: TimeRange | undefined,
  queryType: LokiQueryType | undefined,
  prevQueryType: LokiQueryType | undefined
): boolean {
  if (prevQuery === undefined || query.trim() !== prevQuery.trim() || queryType !== prevQueryType) {
    return true;
  }

  if (
    compareTime(timerange.raw.from, prevTimerange?.raw.from) &&
    compareTime(timerange.raw.to, prevTimerange?.raw.to)
  ) {
    return false;
  }

  return true;
}
