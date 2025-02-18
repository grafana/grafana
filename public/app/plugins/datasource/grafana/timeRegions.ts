import { TimeRange, DataFrame, FieldType } from '@grafana/data';
import { TimeRegionConfig, calculateTimesWithin } from 'app/core/utils/timeRegions';

export function doTimeRegionQuery(name: string, config: TimeRegionConfig, range: TimeRange): DataFrame | undefined {
  if (!config) {
    return undefined;
  }

  const ranges = calculateTimesWithin(config, range, config.timezone);

  if (ranges.length > 0) {
    const frame: DataFrame = {
      fields: [
        { name: 'time', type: FieldType.time, values: ranges.map((r) => r.from), config: {} },
        { name: 'timeEnd', type: FieldType.time, values: ranges.map((r) => r.to), config: {} },
        { name: 'text', type: FieldType.string, values: Array(ranges.length).fill(name), config: {} },
      ],
      length: ranges.length,
    };

    return frame;
  }

  return undefined;
}
