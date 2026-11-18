import { isString } from 'lodash';

import {
  type TimeRange,
  toUtc,
  type AbsoluteTimeRange,
  type RawTimeRange,
  dateTime,
  type DateTime,
  ISO_8601,
  type TimeFragment,
} from '@grafana/data';

type CopiedTimeRangeResult = { range: RawTimeRange; isError: false } | { range: string; isError: true };

export const getShiftedTimeRange = (direction: number, origRange: TimeRange): AbsoluteTimeRange => {
  const range = {
    from: toUtc(origRange.from),
    to: toUtc(origRange.to),
  };

  const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
  let to: number, from: number;

  if (direction === -1) {
    to = range.to.valueOf() - timespan;
    from = range.from.valueOf() - timespan;
  } else if (direction === 1) {
    to = range.to.valueOf() + timespan;
    from = range.from.valueOf() + timespan;
    if (to > Date.now() && range.to.valueOf() < Date.now()) {
      to = Date.now();
      from = range.from.valueOf();
    }
  } else {
    to = range.to.valueOf();
    from = range.from.valueOf();
  }

  return { from, to };
};

export const getZoomedTimeRange = (range: TimeRange, factor: number): AbsoluteTimeRange => {
  const timespan = range.to.valueOf() - range.from.valueOf();
  const center = range.to.valueOf() - timespan / 2;
  // If the timepsan is 0, zooming out would do nothing, so we force a zoom out to 30s
  const newTimespan = timespan === 0 ? 30000 : timespan * factor;

  const to = center + newTimespan / 2;
  const from = center - newTimespan / 2;

  return { from, to };
};

export async function getCopiedTimeRange(): Promise<CopiedTimeRangeResult> {
  const raw = await navigator.clipboard.readText();
  let range;

  try {
    range = JSON.parse(raw);

    if (!range.from || !range.to) {
      return { range: raw, isError: true };
    }

    return { range, isError: false };
  } catch (e) {
    return { range: raw, isError: true };
  }
}

export const toUtcDateTimeIfIsoString = (value: string | DateTime): string | DateTime => {
  if (isString(value) && value.includes('Z')) {
    return dateTime(value).utc();
  }
  return value;
};

/** Format of the compact absolute forms Grafana URLs have carried, by length; anything else is epoch ms or ISO 8601. */
const COMPACT_URL_TIME_FORMATS: Record<number, string> = {
  8: 'YYYYMMDD',
  15: 'YYYYMMDDTHHmmss',
  19: 'YYYY-MM-DD HH:mm:ss',
};

/**
 * One `from`/`to` value as Grafana writes it to a URL: a relative expression (`now-1h`, kept as text), epoch
 * ms, ISO 8601, or a compact absolute form. `null` when it is none of those.
 */
export function parseUrlTime(value: string): TimeFragment | null {
  if (!value) {
    return null;
  }
  if (value.includes('now')) {
    return value;
  }
  const compactFormat = COMPACT_URL_TIME_FORMATS[value.length];
  let time: DateTime;
  if (compactFormat) {
    time = toUtc(value, compactFormat);
  } else if (/^\d+$/.test(value)) {
    time = toUtc(parseInt(value, 10));
  } else {
    // Explicit format: moment's bare string parse falls back to `new Date()` for anything else, with a deprecation warning.
    time = toUtc(value, ISO_8601);
  }
  return time.isValid() ? time : null;
}
