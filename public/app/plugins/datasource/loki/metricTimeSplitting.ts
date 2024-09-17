// every timestamp in this file is a number which contains an unix-timestamp-in-millisecond format,
// like returned by `new Date().getTime()`. this is needed because the "math"
// has to be done on integer numbers.

// we are trying to be compatible with
// https://github.com/grafana/loki/blob/089ec1b05f5ec15a8851d0e8230153e0eeb4dcec/pkg/querier/queryrange/split_by_interval.go#L327-L336

export function splitTimeRange(
  startTime: number,
  endTime: number,
  step: number,
  idealRangeDuration: number
): Array<[number, number]> {
  if (idealRangeDuration < step) {
    // we cannot create chunks smaller than `step`
    return [[startTime, endTime]];
  }

  // we make the duration a multiple of `step`, lowering it if necessary
  const alignedDuration = Math.trunc(idealRangeDuration / step) * step;

  const alignedStartTime = startTime - (startTime % step);

  const result: Array<[number, number]> = [];

  // in a previous version we started iterating from the end, to the start.
  // However this is not easily possible as end timestamps are always inclusive
  // for Loki. So a `2022-02-08T00:00:00Z` end time with a 1day step would mean
  // to include the 08.02.2022, which we don't want. So we have to start from
  // the start, always ending at the last step before the actual end, or the total end.
  for (let chunkStartTime = alignedStartTime; chunkStartTime < endTime; chunkStartTime += alignedDuration) {
    const chunkEndTime = Math.min(chunkStartTime + alignedDuration - step, endTime);
    result.push([chunkStartTime, chunkEndTime]);
  }

  return result;
}
