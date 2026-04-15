import { systemDateFormats, type SystemDateFormatsState } from './formats';
import { dateTimeParse } from './parser';

describe('dateTimeParse', () => {
  it('should parse using the systems configured timezone', () => {
    const date = dateTimeParse('2020-03-02 15:00:22');
    expect(date.format()).toEqual('2020-03-02T15:00:22-05:00');
  });

  it('should be able to parse using default format', () => {
    const date = dateTimeParse('2020-03-02 15:00:22', { timeZone: 'utc' });
    expect(date.format()).toEqual('2020-03-02T15:00:22Z');
  });

  it('should be able to parse using default format', () => {
    systemDateFormats.update({
      fullDate: 'MMMM D, YYYY, h:mm:ss a',
      interval: {} as SystemDateFormatsState['interval'],
      useBrowserLocale: false,
    });

    const date = dateTimeParse('Aug 20, 2020 10:30:20 am', { timeZone: 'utc' });
    expect(date.format()).toEqual('2020-08-20T10:30:20Z');
  });

  it('should be able to parse ISO 8601 date strings when useBrowserLocale is true', () => {
    systemDateFormats.update({
      fullDate: 'YYYY-MM-DD HH:mm:ss.SSS',
      interval: {} as SystemDateFormatsState['interval'],
      useBrowserLocale: true,
    });

    const date = dateTimeParse('2025-03-12T07:09:37.253Z', { timeZone: 'browser' });
    expect(date.isValid()).toBe(true);
    expect(date.format()).toEqual('2025-03-12T07:09:37Z');
  });

  it('should be able to parse array formats used by calendar', () => {
    const date = dateTimeParse([2020, 5, 10, 10, 30, 20], { timeZone: 'utc' });
    expect(date.format()).toEqual('2020-06-10T10:30:20Z');
  });

  describe('epoch millisecond string (issue #119445)', () => {
    // Real scenario from bug report: user sets time picker "from 2026-03-03 00:00:00 to now".
    // Grafana stores absolute dates as epoch ms strings in the URL (e.g. ?from=1772496000000).
    // dateTimeParse("1772496000000") must NOT parse through systemDateFormats.fullDate
    // ("YYYY-MM-DD HH:mm:ss") — that format does not match an epoch ms string and
    // moment.js returns an invalid DateTime whose valueOf() === NaN.
    // NaN propagates to HTTP request body: {"from":"NaN",...} → Postgres backend
    // receives NaN time range → queries return wrong data / hang.
    const EPOCH_MS = '1772496000000'; // 2026-03-03 00:00:00 UTC (from bug report)

    it('should return a valid DateTime', () => {
      const result = dateTimeParse(EPOCH_MS);
      expect(result.isValid()).toBe(true);
    });

    it('should not return NaN from valueOf()', () => {
      const result = dateTimeParse(EPOCH_MS);
      expect(result.valueOf().toString()).not.toBe('NaN');
      expect(result.valueOf()).toBe(1772496000000);
    });
  });
});
