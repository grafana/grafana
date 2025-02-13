import { add, Duration } from 'date-fns';

import { AbsoluteTimeRange, dateTime, TimeRange, reverseParseDuration } from '@grafana/data';

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

// random from the interwebs
function convertSecondsToTime(seconds: number): Duration {
  const secondsInYear = 31536000;
  const secondsInMonth = 2628000;
  const secondsInDay = 86400;
  const secondsInHour = 3600;
  const secondsInMinute = 60;

  let years = Math.floor(seconds / secondsInYear);
  let remainingSeconds = seconds % secondsInYear;

  let months = Math.floor(remainingSeconds / secondsInMonth);
  remainingSeconds %= secondsInMonth;

  let days = Math.floor(remainingSeconds / secondsInDay);
  remainingSeconds %= secondsInDay;

  let hours = Math.floor(remainingSeconds / secondsInHour);
  remainingSeconds %= secondsInHour;

  let minutes = Math.floor(remainingSeconds / secondsInMinute);
  let finalSeconds = remainingSeconds % secondsInMinute;

  return {
    years,
    months,
    days,
    hours,
    minutes,
    seconds: finalSeconds,
  };
}

const secsInDay = 24 * 3600;

interface Range {
  from: ParsedTime;
  to: ParsedTime;
}

export function getDuration({ from, to }: Range) {
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

  return convertSecondsToTime(durSecs);
}

export function convertToCron(cfg: TimeRegionConfig): { cron: string; duration: string } | undefined {
  const hRange = normalizeRange(cfg);
  if (hRange !== undefined) {
    const duration = getDuration(hRange);
    const dow = hRange.from.dayOfWeek !== undefined ? hRange.from.dayOfWeek! - 1 : '*';
    const cronString = `${hRange.from.m} ${hRange.from.h} * * ${dow}`;

    return { cron: cronString, duration: reverseParseDuration(duration, false) };
  } else {
    return undefined;
  }
}

function normalizeRange(cfg: TimeRegionConfig): { from: ParsedTime; to: ParsedTime } | undefined {
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

  if (hRange.to.dayOfWeek && hRange.to.h == null && hRange.to.m == null) {
    hRange.to.h = 23;
    hRange.to.m = 59;
    hRange.to.s = 59;
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

export function calculateTimesWithin(cfg: TimeRegionConfig, tRange: TimeRange): AbsoluteTimeRange[] {
  if (!(cfg.fromDayOfWeek || cfg.from) && !(cfg.toDayOfWeek || cfg.to)) {
    return [];
  }

  const hRange = normalizeRange(cfg);

  if (hRange !== undefined) {
    const regions: AbsoluteTimeRange[] = [];
    const fromStart = dateTime(tRange.from).utc();
    fromStart.set('hour', 0);
    fromStart.set('minute', 0);
    fromStart.set('second', 0);
    fromStart.set('millisecond', 0);
    fromStart.add(hRange.from.h, 'hours');
    fromStart.add(hRange.from.m, 'minutes');
    fromStart.add(hRange.from.s, 'seconds');

    const duration = getDuration(hRange);

    while (fromStart.unix() <= tRange.to.unix()) {
      while (hRange.from.dayOfWeek && hRange.from.dayOfWeek !== fromStart.isoWeekday()) {
        fromStart.add(24, 'hours');
      }

      if (fromStart.unix() > tRange.to.unix()) {
        break;
      }

      const fromEnd = dateTime(add(fromStart.toDate(), duration));

      const outsideRange =
        (fromStart.unix() < tRange.from.unix() && fromEnd.unix() < tRange.from.unix()) ||
        (fromStart.unix() > tRange.to.unix() && fromEnd.unix() > tRange.to.unix());

      if (!outsideRange) {
        regions.push({ from: fromStart.valueOf(), to: fromEnd.valueOf() });
      }

      fromStart.add(24, 'hours');
    }

    return regions;
  } else {
    return [];
  }
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
