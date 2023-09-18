import { DateTime, isDateTime, TimeRange } from '@grafana/data';
import { intervalToMs } from '@grafana/data/src/datetime/rangeutil';
import { Duration } from '@grafana/lezer-logql';

import { LokiDatasource } from '../datasource';
import { getNodesFromQuery, isLogsQuery } from '../queryUtils';
import { LokiQuery, LokiQueryType, QueryStats } from '../types';

export async function getStats(datasource: LokiDatasource, query: LokiQuery): Promise<QueryStats | null> {
  if (!query) {
    return null;
  }

  const response = await datasource.getQueryStats(query);

  if (!response) {
    return null;
  }

  return Object.values(response).every((v) => v === 0) ? null : response;
}

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

export function getTimeRange(
  ds: LokiDatasource,
  query: LokiQuery,
  idx: number
): { start: number | undefined; end: number | undefined } {
  let start: number, end: number;
  const NS_IN_MS = 1000000;
  const durationNodes = getNodesFromQuery(query.expr, [Duration]);
  const durations = durationNodes.map((d) => query.expr.substring(d.from, d.to));

  if (isLogsQuery(query.expr)) {
    // logs query with instant type can not be estimated
    if (query.queryType === LokiQueryType.Instant) {
      return { start: undefined, end: undefined };
    }
    // logs query with range type
    return ds.getTimeRangeParams();
  }

  if (query.queryType === LokiQueryType.Instant) {
    // metric query with instant type

    if (!!durations[idx]) {
      // if query has a duration e.g. [1m]
      end = ds.getTimeRangeParams().end;
      start = end - intervalToMs(durations[idx]) * NS_IN_MS;
      return { start, end };
    } else {
      // if query has no duration e.g. [$__interval]

      if (/(\$__auto|\$__range)/.test(query.expr)) {
        // if $__auto or $__range is used, we can estimate the time range using the selected range
        return ds.getTimeRangeParams();
      }

      // otherwise we cant estimate the time range
      return { start: undefined, end: undefined };
    }
  }

  // metric query with range type
  return ds.getTimeRangeParams();
}
