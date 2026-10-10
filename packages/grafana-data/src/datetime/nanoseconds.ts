import { escapeRegExp } from 'lodash';

import { type RawTimeRange } from '../types/time';

import { systemDateFormats } from './formats';
import { dateTimeFormat } from './formatter';
import { dateTime, type DateTime, ISO_8601, toUtc } from './moment_wrapper';
import { dateTimeParse, type DateTimeOptionsWhenParsing } from './parser';

const NS_PER_MS = BigInt(1000000);

/** Parses fractional seconds separately because DateTime only retains milliseconds. */
export function parseTimeWithNanos(value: RawTimeRange['from'], options?: DateTimeOptionsWhenParsing) {
  if (typeof value !== 'string' || !value.includes('.')) {
    return { time: dateTimeParse(value, options), nanos: 0 };
  }

  const format = options?.format ?? systemDateFormats.fullDate;
  const fraction =
    /^(.*\d{2}:\d{2}:\d{2})\.(\d+)(Z|[+-]\d{2}:?\d{2}|\s+[APap][Mm])?$/.exec(value) ??
    matchFormattedFraction(value, format);
  if (!fraction) {
    return { time: dateTimeParse(value, options), nanos: 0 };
  }
  if (fraction[2].length > 9) {
    return { time: dateTime(NaN), nanos: 0 };
  }

  const digits = fraction[2].padEnd(9, '0');
  const milliseconds = `${fraction[1]}.${digits.slice(0, 3)}${fraction[3] ?? ''}`;
  const time =
    fraction[3] && /^(Z|[+-])/.test(fraction[3])
      ? toUtc(milliseconds, ISO_8601)
      : dateTimeParse(milliseconds, {
          ...options,
          format: format.replace(/ss(?:\.S+)?/, 'ss.SSS'),
        });
  return { time, nanos: time.isValid() ? Number(digits.slice(3)) : 0 };
}

function matchFormattedFraction(value: string, format: string) {
  const tokens = format.match(/\[[^\]]*]|\\.|ss(?:\.S+)?|([A-Za-z])\1*|./g) ?? [];
  const secondsIndex = tokens.findIndex((token) => /^ss(?:\.S+)?$/.test(token));
  if (secondsIndex === -1) {
    return null;
  }

  // Match format literals to locate the fraction; dateTimeParse validates the other date fields.
  const pattern = (tokens: string[]) =>
    tokens
      .map((token) => {
        if (token.startsWith('[')) {
          return escapeRegExp(token.slice(1, -1));
        }
        if (token.startsWith('\\')) {
          return escapeRegExp(token.slice(1));
        }
        return /^[A-Za-z]/.test(token) ? '.+?' : escapeRegExp(token);
      })
      .join('');

  return new RegExp(
    `^(${pattern(tokens.slice(0, secondsIndex))}\\d{1,2})\\.(\\d+)(${pattern(tokens.slice(secondsIndex + 1))})$`
  ).exec(value);
}

export function formatTimeWithNanos(time: DateTime, nanos = 0, timeZone?: string): string {
  validateNanos(nanos);
  return dateTimeFormat(time, {
    timeZone,
    format: systemDateFormats.fullDate.replace(/ss(?:\.S+)?/, `ss.SSS[${nanos.toString().padStart(6, '0')}]`),
  });
}

export function toISOStringWithNanos(time: DateTime, nanos = 0): string {
  validateNanos(nanos);
  const iso = time.toISOString();
  return nanos ? `${iso.slice(0, -1)}${nanos.toString().padStart(6, '0')}Z` : iso;
}

export function toEpochNs(time: DateTime | number, nanos = 0): bigint {
  validateNanos(nanos);
  return BigInt(time.valueOf()) * NS_PER_MS + BigInt(nanos);
}

export function fromEpochNs(timestamp: bigint): { time: DateTime; nanos: number } {
  const nanos = ((timestamp % NS_PER_MS) + NS_PER_MS) % NS_PER_MS;
  return { time: dateTime(Number((timestamp - nanos) / NS_PER_MS)), nanos: Number(nanos) };
}

function validateNanos(nanos: number) {
  if (!Number.isInteger(nanos) || nanos < 0 || nanos >= 1000000) {
    throw new RangeError('Nanosecond remainder must be an integer between 0 and 999999');
  }
}
