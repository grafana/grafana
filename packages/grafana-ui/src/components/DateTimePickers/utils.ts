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
 * Formats a range endpoint with the system date format, adding milliseconds right after the seconds
 * only when the value has a fraction and the range is shorter than a minute. Longer ranges from zoom,
 * shift, drag-select or links carry incidental fractions that would only add noise.
 * dateTimeParse reads a fraction in that position back at full precision.
 */
export function formatWithOptionalMs(
  value: DateTime,
  range: { from: DateTime; to: DateTime },
  timeZone?: TimeZone
): string {
  const { fullDate } = systemDateFormats;
  const showMs =
    value.valueOf() % 1000 !== 0 &&
    Math.abs(range.to.valueOf() - range.from.valueOf()) < MAX_MS_DISPLAY_SPAN &&
    fullDate.includes('ss') &&
    !fullDate.includes('S');
  return dateTimeFormat(value, { timeZone, format: showMs ? fullDate.replace('ss', 'ss.SSS') : undefined });
}
