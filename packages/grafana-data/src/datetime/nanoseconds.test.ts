import { makeTimeRange } from '../types/time';

import { systemDateFormats } from './formats';
import { dateTime } from './moment_wrapper';
import { fromEpochNs, formatTimeWithNanos, parseTimeWithNanos, toEpochNs, toISOStringWithNanos } from './nanoseconds';
import { convertAbsoluteToRaw, convertRawToRange, formatRawTimeRange, toAbsoluteTimeRange } from './rangeutil';

describe('nanosecond time ranges', () => {
  it('creates precise ranges through the existing makeTimeRange helper', () => {
    const range = makeTimeRange('1970-01-01T00:00:00.123000001Z', '1970-01-01T00:00:00.124Z');
    expect(range.from.valueOf()).toBe(123);
    expect(range.to.valueOf()).toBe(124);
    expect(range.fromNano).toBe(1);
    expect(range.raw.from).toBe('1970-01-01T00:00:00.123000001Z');
  });

  it('round-trips fractional seconds with an existing millisecond or AM/PM format', () => {
    const original = systemDateFormats.fullDate;
    try {
      systemDateFormats.fullDate = 'YYYY-MM-DD hh:mm:ss.SSS A';
      const formatted = formatTimeWithNanos(dateTime('1970-01-01T13:00:00.123Z'), 456789, 'utc');
      expect(formatted).toBe('1970-01-01 01:00:00.123456789 PM');
      const parsed = parseTimeWithNanos(formatted, { timeZone: 'utc' });
      expect(parsed.time.valueOf()).toBe(46800123);
      expect(parsed.nanos).toBe(456789);
    } finally {
      systemDateFormats.fullDate = original;
    }
  });

  it.each([
    ['DD.MM.YYYY HH.mm.ss', '01.01.1970 13.00.00.123456789'],
    ['HH[時]mm[分]ss[秒] DD.MM.YYYY', '13時00分00.123456789秒 01.01.1970'],
    ['YYYY-MM-DD h:mm:ss A', '1970-01-01 1:00:00.123456789 PM'],
  ])('round-trips nanoseconds with the configured format %s', (format, expected) => {
    const original = systemDateFormats.fullDate;
    try {
      systemDateFormats.fullDate = format;
      const formatted = formatTimeWithNanos(dateTime('1970-01-01T13:00:00.123Z'), 456789, 'utc');
      expect(formatted).toBe(expected);
      const parsed = parseTimeWithNanos(formatted, { timeZone: 'utc' });
      expect(parsed.time.valueOf()).toBe(46800123);
      expect(parsed.nanos).toBe(456789);
    } finally {
      systemDateFormats.fullDate = original;
    }
  });

  it('uses the explicit parse format to locate fractional seconds', () => {
    const parsed = parseTimeWithNanos('01.01.1970 13.00.00.123456789', {
      format: 'DD.MM.YYYY HH.mm.ss',
      timeZone: 'utc',
    });
    expect(parsed.time.valueOf()).toBe(46800123);
    expect(parsed.nanos).toBe(456789);
  });

  it.each([
    ['1970-01-01T00:00:00.123456789Z', undefined],
    ['01.01.1970 00.00.00.123456789', 'DD.MM.YYYY HH.mm.ss'],
    ['00時00分00.123456789秒 01.01.1970', 'HH[時]mm[分]ss[秒] DD.MM.YYYY'],
  ])('preserves precise input %s with the Luxon implementation', (input, format) => {
    const previous = window.__grafanaUseLuxon;
    window.__grafanaUseLuxon = true;
    try {
      jest.isolateModules(() => {
        const { parseTimeWithNanos, toISOStringWithNanos } = require('./nanoseconds');
        const parsed = parseTimeWithNanos(input, { format, timeZone: 'utc' });
        expect(parsed.time.valueOf()).toBe(123);
        expect(parsed.nanos).toBe(456789);
        expect(toISOStringWithNanos(parsed.time, parsed.nanos)).toBe('1970-01-01T00:00:00.123456789Z');
      });
    } finally {
      window.__grafanaUseLuxon = previous;
    }
  });
  it.each([
    ['1970-01-01T00:00:00.123456789Z', 123, 456789],
    ['1970-01-01T01:00:00.123000018+01:00', 123, 18],
    ['1970-01-01T00:00:00.1234Z', 123, 400000],
    ['1970-01-01T00:00:00.123Z', 123, 0],
    ['1969-12-31T23:59:59.999999999Z', -1, 999999],
  ])('parses %s without rounding the fraction', (input, ms, nanos) => {
    const parsed = parseTimeWithNanos(input);
    expect(parsed.time.valueOf()).toBe(ms);
    expect(parsed.nanos).toBe(nanos);
  });

  it('parses precise picker input in the selected timezone', () => {
    const parsed = parseTimeWithNanos('1970-01-01 01:00:00.123456789', { timeZone: 'Europe/Paris' });
    expect(parsed.time.valueOf()).toBe(123);
    expect(parsed.nanos).toBe(456789);
  });

  it.each(['1970-01-01T00:00:00.1234567890Z', '1970-02-30T00:00:00.123456789Z'])(
    'rejects invalid precise dates: %s',
    (input) => expect(parseTimeWithNanos(input).time.isValid()).toBe(false)
  );

  it('round-trips the last nanosecond before the epoch', () => {
    const { time, nanos } = fromEpochNs(BigInt(-1));
    expect(time.valueOf()).toBe(-1);
    expect(nanos).toBe(999999);
    expect(toISOStringWithNanos(time, nanos)).toBe('1969-12-31T23:59:59.999999999Z');
    expect(toEpochNs(time, nanos).toString()).toBe('-1');
  });

  it('serializes epoch nanoseconds without number precision loss', () => {
    expect(toEpochNs(dateTime('2023-06-14T07:49:50.123Z'), 456789).toString()).toBe('1686728990123456789');
    expect(toISOStringWithNanos(dateTime(123), 18)).toBe('1970-01-01T00:00:00.123000018Z');
    expect(toISOStringWithNanos(dateTime(123))).toBe('1970-01-01T00:00:00.123Z');
  });

  it.each([-1, 1000000, 0.1, NaN])('rejects an invalid remainder: %s', (nanos) => {
    expect(() => toEpochNs(123, nanos)).toThrow(RangeError);
  });

  it('preserves both boundaries through raw, absolute, and clipboard conversions', () => {
    const raw = { from: '1970-01-01T00:00:00.123000001Z', to: '1970-01-01T00:00:00.123999999Z' };
    const range = convertRawToRange(raw);
    expect(range.fromNano).toBe(1);
    expect(range.toNano).toBe(999999);
    expect(toAbsoluteTimeRange(range)).toEqual({ from: 123, to: 123, fromNano: 1, toNano: 999999 });
    expect(convertAbsoluteToRaw(toAbsoluteTimeRange(range))).toEqual(raw);
    expect(formatRawTimeRange(range.raw)).toEqual(raw);
  });

  it('keeps date-math end rounding and omits remainders for ordinary ranges', () => {
    const range = convertRawToRange({ from: 'now/d', to: 'now/d' }, 'utc');
    expect(range.from.format('HH:mm:ss.SSS')).toBe('00:00:00.000');
    expect(range.to.format('HH:mm:ss.SSS')).toBe('23:59:59.999');
    expect(range.fromNano).toBeUndefined();
    expect(range.toNano).toBeUndefined();
  });
});
