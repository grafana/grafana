import {
  TimeRange,
  DataFrame,
  FieldType,
  ArrayVector,
  DataFrameType,
  FieldColorModeId,
  DataTopic,
} from '@grafana/data';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';

import { TimeRegionConfig } from './types';

// Returns a frame true/false values set at each region shift
export function doTimeRegionQuery(config: TimeRegionConfig, range: TimeRange, tz: string): DataFrame | undefined {
  const regions = calculateTimesWithin(config, range);
  if (!regions.length) {
    return undefined;
  }

  const times: number[] = [];
  const timesEnd: number[] = [];
  const colors: string[] = [];

  for (const region of regions) {
    times.push(region.from);
    timesEnd.push(region.to);
    colors.push(config.color);
  }

  return {
    meta: {
      type: DataFrameType.TimeRanges,
      dataTopic: DataTopic.Annotations,
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
    ],
    length: times.length,
  };
}
