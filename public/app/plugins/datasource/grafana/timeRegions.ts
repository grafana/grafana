import { TimeRange, DataFrame, FieldType, ArrayVector, getTimeZoneInfo, DataFrameType } from '@grafana/data';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';

import { TimeRegionConfig } from './types';

export function doTimeRegionQuery(
  name: string,
  config: TimeRegionConfig,
  range: TimeRange,
  tz: string
): DataFrame | undefined {
  if (!config) {
    return undefined;
  }
  const regions = calculateTimesWithin(config, range); // UTC
  if (!regions.length) {
    return undefined;
  }

  const times: number[] = [];
  const timesEnd: number[] = [];
  const texts: string[] = [];

  const regionTimezone = config.timezone ?? tz;

  for (const region of regions) {
    let from = region.from;
    let to = region.to;

    const info = getTimeZoneInfo(regionTimezone, from);
    if (info) {
      const offset = info.offsetInMins * 60 * 1000;
      from += offset;
      to += offset;
    }

    times.push(from);
    timesEnd.push(to);
    texts.push(name);
  }

  return {
    meta: {
      type: DataFrameType.TimeRanges,
      //  dataTopic: DataTopic.Annotations,
    },
    fields: [
      { name: 'time', type: FieldType.time, values: new ArrayVector(times), config: {} },
      { name: 'timeEnd', type: FieldType.time, values: new ArrayVector(timesEnd), config: {} },
      { name: 'text', type: FieldType.string, values: new ArrayVector(texts), config: {} },
    ],
    length: times.length,
  };
}
