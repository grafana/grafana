import { isString } from 'lodash';

import { TimeRange, toUtc, AbsoluteTimeRange, RawTimeRange, dateTime, DateTime } from '@grafana/data';

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
