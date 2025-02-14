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

interface ParsedTime {
  dayOfWeek?: number; // 1-7
  h?: number; // 0-23
  m?: number; // 0-59
  s?: number; // 0-59
}

const secsInDay = 24 * 3600;

interface Range {
  from: ParsedTime;
  to: ParsedTime;
}

function getDurationSecs({ from, to }: Range) {
  const fromDay = from.dayOfWeek ?? 0;
  const fromHour = from.h ?? 0;
  const fromMin = from.m ?? 0;

  const toDay = to.dayOfWeek ?? fromDay;
  const toHour = to.h ?? fromHour;
  const toMin = to.m ?? fromMin;

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

export function convertToCron(cfg: TimeRegionConfig) {
  const range = normalizeRange(cfg);

  if (range != null) {
    let { m, h, dayOfWeek } = range.from;
    let dow = dayOfWeek != null ? dayOfWeek : '*';

    return {
      cronExpr: `${m} ${h} * * ${dow}`,
      duration: getDurationSecs(range),
    };
  }

  return undefined;
}

function normalizeRange(cfg: TimeRegionConfig): Range | undefined {
  // So we can mutate
  const timeRegion = { ...cfg };

  if (timeRegion.from && !timeRegion.to) {
    timeRegion.to = timeRegion.from;
  }

  if (!timeRegion.from && timeRegion.to) {
    timeRegion.from = timeRegion.to;
  }

  const hRange = {
    from: parseTimeOfDay(timeRegion.from),
    to: parseTimeOfDay(timeRegion.to),
  };

  if (!timeRegion.fromDayOfWeek && timeRegion.toDayOfWeek) {
    timeRegion.fromDayOfWeek = timeRegion.toDayOfWeek;
  }

  if (!timeRegion.toDayOfWeek && timeRegion.fromDayOfWeek) {
    timeRegion.toDayOfWeek = timeRegion.fromDayOfWeek;
  }

  if (timeRegion.fromDayOfWeek) {
    hRange.from.dayOfWeek = Number(timeRegion.fromDayOfWeek);
  }

  if (timeRegion.toDayOfWeek) {
    hRange.to.dayOfWeek = Number(timeRegion.toDayOfWeek);
  }

  if (hRange.from.dayOfWeek && hRange.from.h == null && hRange.from.m == null) {
    hRange.from.h = 0;
    hRange.from.m = 0;
    hRange.from.s = 0;
  }

  // when "to" time is undefined it implies the end "to" dayOfWeek ¯\_(ツ)_/¯
  if (hRange.to.dayOfWeek && hRange.to.h == null && hRange.to.m == null) {
    // roll to next day 00:00
    hRange.to.dayOfWeek += hRange.to.dayOfWeek === 7 ? -6 : 1;

    hRange.to.h = 0;
    hRange.to.m = 0;
    hRange.to.s = 0;
  }

  if (!hRange.from || !hRange.to) {
    return undefined;
  }

  if (hRange.from.h == null) {
    hRange.from.h = 0;
  }

  if (hRange.to.h == null) {
    hRange.to.h = 23;
  }

  return hRange;
}

export function calculateTimesWithin(cfg: TimeRegionConfig, tRange: TimeRange, timezone?: string): AbsoluteTimeRange[] {
  const ranges: AbsoluteTimeRange[] = [];

  const mode = cfg.mode ?? 'simple';

  let cronExpr = '';
  let durationMs = 0;

  if (mode === 'simple') {
    const cron = convertToCron(cfg);

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

export function parseTimeOfDay(str?: string): ParsedTime {
  const result: ParsedTime = {};
  if (!str?.length) {
    return result;
  }

  const match = str.split(':');
  if (!match?.length) {
    return result;
  }

  result.h = Math.min(23, Math.max(0, Number(match[0])));
  if (match.length > 1) {
    result.m = Math.min(60, Math.max(0, Number(match[1])));
    if (match.length > 2) {
      result.s = Math.min(60, Math.max(0, Number(match[2])));
    }
  }
  return result;
}
