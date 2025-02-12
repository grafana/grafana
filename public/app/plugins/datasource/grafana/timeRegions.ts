import { Cron } from 'croner';

import { TimeRange, DataFrame, FieldType, durationToMilliseconds, parseDuration } from '@grafana/data';
import { TimeRegionConfig, convertToCron } from 'app/core/utils/timeRegions';

export function doTimeRegionQuery(
  name: string,
  config: TimeRegionConfig,
  range: TimeRange,
  tz: string
): DataFrame | undefined {
  if (!config) {
    return undefined;
  }

  if (config.mode === 'simple') {
    const cronConfig = convertToCron(config);
    config.cronExpr = cronConfig?.cron;
    config.duration = cronConfig?.duration;
  }

  if (config.duration?.length && config.cronExpr) {
    try {
      let job = new Cron(config.cronExpr);

      // get previous run that may overlap with start of timerange
      let durationMs = durationToMilliseconds(parseDuration(config.duration));
      let fromDate: Date | null = new Date(range.from.valueOf() - durationMs);

      let toMs = range.to.valueOf();
      let nextDate = job.nextRun(fromDate);

      const times: number[] = [];
      const timesEnd: number[] = [];
      const texts: string[] = [];

      while (nextDate != null) {
        let nextMs = +nextDate;

        if (nextMs > toMs) {
          break;
        } else {
          times.push(nextMs);
          nextDate = job.nextRun(nextDate);
        }
      }

      if (times.length > 0) {
        times.forEach((t) => {
          timesEnd.push(t + durationMs);
          texts.push(name);
        });

        return toFrame(times, timesEnd, texts);
      }
    } catch (e) {
      // invalid expression
      console.error(e);
    }
  }

  return undefined;
}

function toFrame(times: number[], timesEnd: number[], texts: string[]) {
  return {
    fields: [
      { name: 'time', type: FieldType.time, values: times, config: {} },
      { name: 'timeEnd', type: FieldType.time, values: timesEnd, config: {} },
      { name: 'text', type: FieldType.string, values: texts, config: {} },
    ],
    length: times.length,
  };
}
