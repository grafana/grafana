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

  it('should retain millisecond precision when parsing a date string with milliseconds', () => {
    systemDateFormats.update({
      fullDate: 'YYYY-MM-DD HH:mm:ss',
      interval: {} as SystemDateFormatsState['interval'],
      useBrowserLocale: false,
    });

    const date = dateTimeParse('2020-03-02 15:00:22.123', { timeZone: 'utc' });
    expect(date.isValid()).toBe(true);
    expect(date.format('YYYY-MM-DD HH:mm:ss.SSS')).toEqual('2020-03-02 15:00:22.123');
  });

  it('should still parse a date string without milliseconds using the default format', () => {
    systemDateFormats.update({
      fullDate: 'YYYY-MM-DD HH:mm:ss',
      interval: {} as SystemDateFormatsState['interval'],
      useBrowserLocale: false,
    });

    const date = dateTimeParse('2020-03-02 15:00:22', { timeZone: 'utc' });
    expect(date.format()).toEqual('2020-03-02T15:00:22Z');
  });

  it('should be able to parse array formats used by calendar', () => {
    const date = dateTimeParse([2020, 5, 10, 10, 30, 20], { timeZone: 'utc' });
    expect(date.format()).toEqual('2020-06-10T10:30:20Z');
  });
});
