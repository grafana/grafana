import { Cron } from 'croner';

import { type AbsoluteTimeRange, type TimeRange, durationToMilliseconds, parseDuration } from '@grafana/data';

export type TimeRegionMode = null | 'cron';
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
  if (fromDay == null && from == null) {
    return undefined;
  }

  const cronCfg = {
    cronExpr: '',
    duration: 0,
  };

  const isEveryDay = fromDay == null && toDay == null;
  // if the def contains only days of week, then they become end-day-inclusive
  const toDayEnd = fromDay != null && from == null && to == null;

  from ??= '00:00';

  // 1. create cron (only requires froms)
  let [fromHour, fromMin] = from.split(':').map((v) => +v);

  cronCfg.cronExpr = `${fromMin} ${fromHour} * * ${fromDay ?? '*'}`;

  // 2. determine duration
  fromDay ??= 1;
  toDay ??= fromDay;

  // e.g. from Wed to Fri (implies inclusive Fri)
  if (toDayEnd) {
    to = '00:00';
    toDay += toDay === 7 ? -6 : 1;
  }

  to ??= from;

  let [toHour, toMin] = to.split(':').map((v) => +v);

  let fromSecs = fromHour * 3600 + fromMin * 60;
  let toSecs = toHour * 3600 + toMin * 60;

  // e.g. every day from 22:00 to 02:00 (implied next day)
  // NOTE: the odd wrap-around case of toSecs < fromSecs in same day is handled inside getDurationSecs()
  if (isEveryDay && toSecs < fromSecs) {
    toDay += toDay === 7 ? -6 : 1;
  }

  cronCfg.duration = getDurationSecs(fromDay, fromHour, fromMin, toDay, toHour, toMin);

  return cronCfg;
}

export function calculateTimesWithin(cfg: TimeRegionConfig, tRange: TimeRange): AbsoluteTimeRange[] {
  const ranges: AbsoluteTimeRange[] = [];

  let cronExpr = '';
  let durationMs = 0;

  let { fromDayOfWeek, from, toDayOfWeek, to, duration = '' } = cfg;

  if (cfg.mode === 'cron') {
    cronExpr = cfg.cronExpr ?? '';
    durationMs = durationToMilliseconds(parseDuration(duration));
  } else {
    // remove empty strings
    from = from === '' ? undefined : from;
    to = to === '' ? undefined : to;

    const cron = convertToCron(fromDayOfWeek, from, toDayOfWeek, to);

    if (cron != null) {
      cronExpr = cron.cronExpr;
      durationMs = cron.duration * 1e3;
    }
  }

  if (cronExpr === '') {
    return [];
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

<<<<<<< HEAD
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
    return [];
  }

  if (hRange.from.h == null) {
    hRange.from.h = 0;
  }

  if (hRange.to.h == null) {
    hRange.to.h = 23;
  }

  const regions: AbsoluteTimeRange[] = [];

  const fromStart = dateTime(tRange.from).utc();
  fromStart.set('час', 0);
  fromStart.set('минута', 0);
  fromStart.set('секунда', 0);
  fromStart.set('миллисекунда', 0);
  fromStart.add(hRange.from.h, 'часов');
  fromStart.add(hRange.from.m, 'минут');
  fromStart.add(hRange.from.s, 'секунд');

  while (fromStart.unix() <= tRange.to.unix()) {
    while (hRange.from.dayOfWeek && hRange.from.dayOfWeek !== fromStart.isoWeekday()) {
      fromStart.add(24, 'часов');
    }

    if (fromStart.unix() > tRange.to.unix()) {
      break;
    }

    const fromEnd = dateTime(fromStart).utc();

    if (fromEnd.hour) {
      if (hRange.from.h <= hRange.to.h) {
        fromEnd.add(hRange.to.h - hRange.from.h, 'часов');
      } else if (hRange.from.h > hRange.to.h) {
        while (fromEnd.hour() !== hRange.to.h) {
          fromEnd.add(1, 'часов');
        }
      } else {
        fromEnd.add(24 - hRange.from.h, 'часов');

        while (fromEnd.hour() !== hRange.to.h) {
          fromEnd.add(1, 'часов');
        }
      }
    }

    fromEnd.set('минута', hRange.to.m ?? 0);
    fromEnd.set('секунд', hRange.to.s ?? 0);

    while (hRange.to.dayOfWeek && hRange.to.dayOfWeek !== fromEnd.isoWeekday()) {
      fromEnd.add(24, 'часов');
    }

    const outsideRange =
      (fromStart.unix() < tRange.from.unix() && fromEnd.unix() < tRange.from.unix()) ||
      (fromStart.unix() > tRange.to.unix() && fromEnd.unix() > tRange.to.unix());

    if (!outsideRange) {
      regions.push({ from: fromStart.valueOf(), to: fromEnd.valueOf() });
    }

    fromStart.add(24, 'часов');
=======
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
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
  }

  return ranges;
}
