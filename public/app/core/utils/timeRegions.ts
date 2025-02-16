import { Cron } from 'croner';

import { AbsoluteTimeRange, TimeRange, durationToMilliseconds, parseDuration } from '@grafana/data';

export type TimeRegionMode = 'simple' | 'cron';
export interface TimeRegionConfig {
  mode?: TimeRegionMode;

  from?: string;
  fromDayOfWeek?: number; // 1-7

  to?: string;
  toDayOfWeek?: number; // 1-7

  timezone?: string;

  cronExpr?: string; // 0 9 * * 1-5
  duration?: string; // 8h
}

const secsInDay = 24 * 3600;

function getDurationSecs(
  fromDay: number,
  fromHour: number,
  fromMin: number,
  toDay: number,
  toHour: number,
  toMin: number
) {
  let days = toDay - fromDay;

  // account for rollover
  if (days < 0) {
    days += 7;
  }

  let fromSecs = fromHour * 3600 + fromMin * 60;
  let toSecs = toHour * 3600 + toMin * 60;

  let durSecs = 0;

  // account for toTime < fromTime on same day
  if (days === 0 && toSecs < fromSecs) {
    durSecs = 7 * secsInDay - (fromSecs - toSecs);
  } else {
    let daysSecs = days * secsInDay;
    durSecs = daysSecs - fromSecs + toSecs;
  }

  return durSecs;
}

export function convertToCron(
  fromDay?: number | null,
  from?: string | null,
  toDay?: number | null,
  to?: string | null
) {
  // valid defs must have a "from"
  if (fromDay != null || from != null) {
    const cronCfg = {
      cronExpr: '',
      duration: 0,
    };

    // point annos (duration = 0) must have absent "to" or "to" == "from"
    if ((toDay == null || toDay === fromDay) && (to == null || to === from)) {
      from ??= '00:00';

      let [fromHour, fromMin] = from.split(':').map((v) => +v);

      let fromDoW = fromDay ?? '*';
      cronCfg.cronExpr = `${fromMin} ${fromHour} * * ${fromDoW}`;

      return cronCfg;
    }
    // region annos (duration > 0) must have a "to"
    else if (toDay != null || to != null) {
      let isEveryDay = false;

      from ??= '00:00';

      // if fromDay is every day, toDay must be every day
      if (fromDay == null) {
        toDay = null;
        isEveryDay = true;
      }

      if (toDay != null) {
        // default inclusive to end of day (start of next day)
        // (this could become a point anno for wrap cases like from: Mon to: Sun)
        if (to == null) {
          to = '00:00';
          toDay += toDay === 7 ? -6 : 1;
        }
      }

      // (this could become a point anno)
      to ??= from;

      // parse from/to times
      let [fromHour, fromMin] = from.split(':').map((v) => +v);
      let [toHour, toMin] = to.split(':').map((v) => +v);

      let fromSecs = fromHour * 3600 + fromMin * 60;
      let toSecs = toHour * 3600 + toMin * 60;

      let fromDoW = fromDay ?? '*';
      cronCfg.cronExpr = `${fromMin} ${fromHour} * * ${fromDoW}`;

      // for duration calc, we fall back to same day
      fromDay ??= 1;

      // if every day and to < from (every day from 22:00 to 02:00), then set toDayOfWeek to next day
      if (isEveryDay && fromSecs < toSecs) {
        toDay = fromDay + (fromDay === 7 ? -6 : 1);
      }

      toDay ??= fromDay;

      cronCfg.duration = getDurationSecs(fromDay, fromHour, fromMin, toDay, toHour, toMin);

      return cronCfg;
    }
  }

  return undefined;
}

export function calculateTimesWithin(cfg: TimeRegionConfig, tRange: TimeRange, timezone?: string): AbsoluteTimeRange[] {
  const ranges: AbsoluteTimeRange[] = [];

  const mode = cfg.mode ?? 'simple';

  let cronExpr = '';
  let durationMs = 0;

  if (mode === 'simple') {
    const cron = convertToCron(cfg.fromDayOfWeek, cfg.from, cfg.toDayOfWeek, cfg.to);

    if (cron != null) {
      cronExpr = cron?.cronExpr;
      durationMs = cron?.duration * 1e3;
    }
  } else if (mode === 'cron') {
    cronExpr = cfg.cronExpr!;
    durationMs = (cfg.duration ?? '') !== '' ? durationToMilliseconds(parseDuration(cfg.duration!)) : 0;
  }

  try {
    let tz = cfg.timezone === 'browser' ? undefined : cfg.timezone === 'utc' ? 'Etc/UTC' : cfg.timezone;

    let job = new Cron(cronExpr, { timezone: tz });

    // get previous run that may overlap with start of timerange
    let fromDate: Date | null = new Date(tRange.from.valueOf() - durationMs);

    let toMs = tRange.to.valueOf();
    let nextDate = job.nextRun(fromDate);

    while (nextDate != null) {
      let nextMs = +nextDate;

      if (nextMs > toMs) {
        break;
      } else {
        ranges.push({
          from: nextMs,
          to: nextMs + durationMs,
        });
        nextDate = job.nextRun(nextDate);
      }
    }
  } catch (e) {
    // invalid expression
    console.error(e);
  }

  return ranges;
}

