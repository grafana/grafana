// every timestamp in this file is a number which contains an unix-timestamp-in-millisecond format,
// like returned by `new Date().getTime()`. this is needed because the "math"
// has to be done on integer numbers.

// we are trying to be compatible with
// https://github.com/grafana/loki/blob/089ec1b05f5ec15a8851d0e8230153e0eeb4dcec/pkg/querier/queryrange/split_by_interval.go#L327-L336

function expandTimeRange(startTime: number, endTime: number, step: number): [number, number] {
  // startTime is decreased to the closes multiple-of-step, if necessary
  const newStartTime = startTime - (startTime % step);

  // endTime is increased to the closed multiple-of-step, if necessary
  let newEndTime = endTime;
  const endStepMod = endTime % step;
  if (endStepMod !== 0) {
    newEndTime += step - endStepMod;
  }

  return [newStartTime, newEndTime];
}

export function getRangePartition(
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

  const [alignedStartTime, alignedEndTime] = expandTimeRange(startTime, endTime, step);

  const result: Array<[number, number]> = [];

  // we iterate it from the end, because we want to have the potentially smaller chunk at the end, not at the beginning
  for (let chunkEndTime = alignedEndTime; chunkEndTime > alignedStartTime; chunkEndTime -= alignedDuration + step) {
    // when we get close to the start of the time range, we need to be sure not
    // to cross over the startTime
    const chunkStartTime = Math.max(chunkEndTime - alignedDuration, alignedStartTime);
    result.push([chunkStartTime, chunkEndTime]);
  }

  // because we walked backwards, we need to reverse the array
  result.reverse();

  return result;
}
