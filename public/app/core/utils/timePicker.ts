import { isString } from 'lodash';

import {
  type TimeRange,
  toUtc,
  type AbsoluteTimeRange,
  type RawTimeRange,
  dateTime,
  type DateTime,
  parseTimeWithNanos,
  fromEpochNs,
  toEpochNs,
} from '@grafana/data';

type CopiedTimeRangeResult = { range: RawTimeRange; isError: false } | { range: string; isError: true };

export const getShiftedTimeRange = (direction: number, origRange: TimeRange): AbsoluteTimeRange => {
  if (origRange.fromNano || origRange.toNano) {
    const from = toEpochNs(origRange.from, origRange.fromNano);
    const to = toEpochNs(origRange.to, origRange.toNano);
    const shift = ((to - from + BigInt(1)) / BigInt(2)) * BigInt(direction === -1 ? -1 : direction === 1 ? 1 : 0);
    const now = toEpochNs(Date.now());
    return direction === 1 && to < now && to + shift > now
      ? absoluteRangeFromNanos(from, now)
      : absoluteRangeFromNanos(from + shift, to + shift);
  }
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
  if (range.fromNano || range.toNano) {
    const from = toEpochNs(range.from, range.fromNano);
    const to = toEpochNs(range.to, range.toNano);
    const span = to - from;
    const newSpan =
      span === BigInt(0)
        ? BigInt(30000000000)
        : Number.isInteger(factor)
          ? span * BigInt(factor)
          : BigInt(Math.round(Number(span) * factor));
    const padding = (newSpan - span) / BigInt(2);
    return absoluteRangeFromNanos(from - padding, from - padding + newSpan);
  }
  const timespan = range.to.valueOf() - range.from.valueOf();
  const center = range.to.valueOf() - timespan / 2;
  // If the timepsan is 0, zooming out would do nothing, so we force a zoom out to 30s
  const newTimespan = timespan === 0 ? 30000 : timespan * factor;

  const to = center + newTimespan / 2;
  const from = center - newTimespan / 2;

  return { from, to };
};

function absoluteRangeFromNanos(from: bigint, to: bigint): AbsoluteTimeRange {
  const start = fromEpochNs(from);
  const end = fromEpochNs(to);
  return {
    from: start.time.valueOf(),
    to: end.time.valueOf(),
    ...(start.nanos ? { fromNano: start.nanos } : {}),
    ...(end.nanos ? { toNano: end.nanos } : {}),
  };
}

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
  if (parseTimeWithNanos(value).nanos) {
    return value;
  }
  if (isString(value) && value.includes('Z')) {
    return dateTime(value).utc();
  }
  return value;
};
