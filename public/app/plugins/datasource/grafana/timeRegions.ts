import { TimeRange, DataFrame, FieldType, ArrayVector } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';

import { TimeRegionConfig } from './types';

// Returns a frame true/false values set at each region shift
export function doTimeRegionQuery(config: TimeRegionConfig, range: TimeRange, tz: string): DataFrame | undefined {
  const regions = calculateTimesWithin(config, range);
  if (!regions.length) {
    return undefined;
  }

  const times: number[] = [];
  const values: boolean[] = [];
  for (const region of regions) {
    times.push(region.from);
    values.push(true);
    times.push(region.to);
    values.push(false);
  }
  return {
    fields: [
      { name: 'Time', type: FieldType.time, values: new ArrayVector(times), config: {} },
      {
        name: config.name ?? 'Region',
        type: FieldType.boolean,
        values: new ArrayVector(values),
        config: {
          color: {
            mode: FieldColorModeId.Fixed,
            fixedColor: config.color,
          },
        },
      },
    ],
    length: times.length,
  };
}
