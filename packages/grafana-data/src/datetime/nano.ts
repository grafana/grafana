import { TimeRange } from '..';

import { DateTime, dateTime, ISO_8601 } from './moment_wrapper';

/**
 * checks if the string is a valid data-iso-string, with an optional nanosecond-part.
 * please note that the spec allows `new Date().toISOString()` to also return
 * 6digit year-numbers, so we need to handle those too
 * ( see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString )
 */
const ISO_NANO_REGEX = /^(?:\d{4}|(?:[+-]\d{6}))-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{6})?Z$/;

export function isISONanoString(value: string): boolean {
  return ISO_NANO_REGEX.test(value);
}

/**
 * Helper function to parse an iso-date-string that may contain a nanosecond-part
 */
export function fromISONanoString(value: string): [DateTime, number] | null {
  // we assume the string is a valid iso-string, and check where the dot is.
  if (value.at(-5) === '.') {
    // no nanosecond part
    return [dateTime(value, ISO_8601), 0];
  }

  if (value.at(-11) === '.') {
    const mainPart = value.slice(0, -7);
    const nanoPart = value.slice(-7, -1);
    return [dateTime(mainPart + 'Z', ISO_8601), Number(nanoPart)];
  }

  // invalid iso string
  return null;
}

/**
 * Helper function to create an iso-date-string with a nanosecond-part
 */
export function toISONanoString(value: DateTime, nano: number): string {
  // first we convert to a millisecond-precision iso-string,
  // this always ends with `Thh:mm:ss.sssZ`
  const isoValue = value.toISOString();
  if (nano === 0) {
    return isoValue;
  }

  const nanoText = nano.toString().padStart(6, '0');

  return isoValue.slice(0, -1) + nanoText + 'Z';
}

export function createTimeRangeWithNano(from: DateTime, to: DateTime, fromNano: number, toNano: number): TimeRange {
  if (fromNano === 0 && toNano === 0) {
    return {
      from,
      to,
      raw: {
        from,
        to,
      },
    };
  }

  return {
    from,
    to,
    fromNano,
    toNano,
    raw: {
      from: toISONanoString(from, fromNano),
      to: toISONanoString(to, toNano),
    },
  };
}
