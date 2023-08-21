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

  // TODO: fix this..
  // duration nodes are empty is variable is used
  // this is because the variable is not converted to a duration, therefore not detected as a duration node
  const durationNodes = getNodesFromQuery(query.expr, [Duration]);
  const durations = durationNodes.map((d) => query.expr.substring(d.from, d.to));

  if (!isLogsQuery(query.expr)) {
    if (query.queryType === LokiQueryType.Instant) {
      // metric query with instant type
      // we want the request timerange to be the query duration e.g. [5m]
      // with the query -- rate({label="value"} [1h]) -- the range we want to request is: "now - 1h"
      end = ds.getTimeRangeParams().end;
      start = end - intervalToMs(durations[idx]) * NS_IN_MS;
    } else {
      // metric query with range type
      // we want the time range to be the selected range
      // we also need to add the duration to this time range for a more accurate result
      ({ start, end } = ds.getTimeRangeParams());
      start = start - intervalToMs(durations[idx]) * NS_IN_MS;
    }

    return { start, end };
  } else {
    if (query.queryType === LokiQueryType.Instant) {
      return { start: undefined, end: undefined };
    }

    return ds.getTimeRangeParams();
  }
}
