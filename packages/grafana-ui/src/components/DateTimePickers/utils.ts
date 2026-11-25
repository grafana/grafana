import {
  dateMath,
  type DateTime,
  dateTimeFormat,
  dateTimeParse,
  isDateTime,
  systemDateFormats,
  type TimeRange,
  type TimeZone,
} from '@grafana/data';

export function isValid(value: string, roundUp?: boolean, timeZone?: TimeZone): boolean {
  if (isDateTime(value)) {
    return value.isValid();
  }

  // handles `now` math
  if (dateMath.isMathString(value)) {
    return dateMath.isValid(value);
  }

  const parsed = dateTimeParse(value, { roundUp, timeZone });
  return parsed.isValid();
}

export function isValidTimeRange(range: TimeRange) {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
}

const MAX_MS_DISPLAY_SPAN = 60 * 1000;

/**
 * Formats with the system date format, adding milliseconds right after the seconds only when the
 * value has a fraction. dateTimeParse reads a fraction in that position back at full precision.
 *
 * Pass `range` for read-only labels: milliseconds are then also limited to ranges shorter than a
 * minute, because zoom, shift, drag-select and links produce longer ranges with incidental fractions
 * that would only add noise. Editable inputs omit it so the value shown is the value applied.
 */
export function formatWithOptionalMs(
  value: DateTime,
  timeZone?: TimeZone,
  range?: { from: DateTime; to: DateTime }
): string {
  const { fullDate } = systemDateFormats;
  const showMs =
    value.valueOf() % 1000 !== 0 &&
    (!range || Math.abs(range.to.valueOf() - range.from.valueOf()) < MAX_MS_DISPLAY_SPAN) &&
    fullDate.includes('ss') &&
    !fullDate.includes('S');
  return dateTimeFormat(value, { timeZone, format: showMs ? fullDate.replace('ss', 'ss.SSS') : undefined });
}
