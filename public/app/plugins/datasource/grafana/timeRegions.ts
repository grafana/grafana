import { Cron } from 'croner';

import { TimeRange, DataFrame, FieldType, getTimeZoneInfo, durationToMilliseconds, parseDuration } from '@grafana/data';
import { TimeRegionConfig, calculateTimesWithin } from 'app/core/utils/timeRegions';

export function doTimeRegionQuery(
  name: string,
  config: TimeRegionConfig,
  range: TimeRange,
  tz: string
): DataFrame | undefined {
  if (!config) {
    return undefined;
  }

  if (config.mode === 'cron') {
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
  } else {
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

    return toFrame(times, timesEnd, texts);
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
