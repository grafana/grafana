import { TimeRange, DataFrame, FieldType, ArrayVector, FieldColorModeId, getTimeZoneInfo } from '@grafana/data';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';

import { TimeRegionConfig } from './types';

export function doTimeRegionQuery(config: TimeRegionConfig, range: TimeRange, tz: string): DataFrame | undefined {
  const regionTimezone = config.timezone ?? tz;

  const regions = calculateTimesWithin(config, range); // UTC
  if (!regions.length) {
    return undefined;
  }

  const times: number[] = [];
  const timesEnd: number[] = [];
  const colors: string[] = [];
  const lines: boolean[] = [];

  // @TODO !!!
  for (const region of regions) {
    let from = region.from;
    let to = region.to;

    // find offset

    console.log('from', from);

    times.push(from);
    timesEnd.push(to);
    colors.push(config.color);
    lines.push(config.line ?? false);
  }

  return {
    meta: {
      // type: DataFrameType.TimeRanges,
      // dataTopic: DataTopic.Annotations,
    },
    fields: [
      { name: 'time', type: FieldType.time, values: new ArrayVector(times), config: {} },
      { name: 'timeEnd', type: FieldType.time, values: new ArrayVector(timesEnd), config: {} },
      {
        name: 'color',
        type: FieldType.string,
        values: new ArrayVector(colors),
        config: { color: { mode: FieldColorModeId.Fixed, fixedColor: config.color } },
      },
      { name: 'line', type: FieldType.boolean, values: new ArrayVector(lines), config: {} },
    ],
    length: times.length,
  };
}
