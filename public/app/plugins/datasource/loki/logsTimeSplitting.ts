// every timestamp in this file is a number which contains an unix-timestamp-in-millisecond format,
// like returned by `new Date().getTime()`. this is needed because the "math"
// has to be done on integer numbers.

import { toUtc } from '@grafana/data/datetime';
import type { TimeRange } from '@grafana/data/types';

// the way loki handles logs-range-queries is that if you specify start & end,
// one of those will be included, but the other will not. this allows us to
// make it easy to split ranges.
// for example, if the time-range is 100<>150,
// we can split it into:
// - 100<>120
// - 120<>140
// - 140<>150
// and no log-line will be skipped or duplicated
// (NOTE: we do these calculations in milliseconds. at the end, Loki receives
// nanoseconds, but it will be OK, because it's simply a matter to adding `000000`,
// to the end, so if we do it right in milliseconds, it should be OK in
// nanoseconds too

export function splitTimeRange(
  startTime: number,
  endTime: number,
  idealRangeDuration: number
): Array<[number, number]> {
  if (endTime - startTime <= idealRangeDuration) {
    return [[startTime, endTime]];
  }

  const result: Array<[number, number]> = [];

  // we walk backward, because we need want the potentially smaller "last" chunk
  // to be at the oldest timestamp.
  for (let chunkEndTime = endTime; chunkEndTime > startTime; chunkEndTime -= idealRangeDuration) {
    // when we get close to the start of the time range, we need to be sure not
    // to cross over the startTime
    const chunkStartTime = Math.max(chunkEndTime - idealRangeDuration, startTime);
    result.push([chunkStartTime, chunkEndTime]);
  }

  // because we walked backwards, we need to reverse the array
  result.reverse();

  return result;
}

export function splitTimeRangeAligned(timeRange: TimeRange): Array<[number, number]> {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const startTime = timeRange.from.valueOf();
  const endTime = timeRange.to.valueOf();

  if (endTime - startTime <= oneDayMs) {
    return [[startTime, endTime]];
  }

  const result: Array<[number, number]> = [];

  const startOfFirstDay = toUtc(endTime).startOf('day').valueOf();
  result.push([startOfFirstDay, endTime]);

  for (let chunkEndTime = startOfFirstDay; chunkEndTime > startTime; chunkEndTime -= oneDayMs) {
    const chunkStartTime = Math.max(chunkEndTime - oneDayMs, startTime);
    result.push([chunkStartTime, chunkEndTime]);
  }

  result.reverse();

  return result;
}
