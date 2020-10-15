import {
  dateTimeAsIso,
  dateTimeAsIsoNoDateIfToday,
  dateTimeAsUS,
  dateTimeAsUSNoDateIfToday,
  dateTimeFromNow,
  Interval,
  toClock,
  toDuration,
  toDurationInMilliseconds,
  toDurationInSeconds,
  toDurationInHoursMinutesSeconds,
  toDurationInDaysHoursMinutesSeconds,
  toNanoSeconds,
  toSeconds,
} from './dateTimeFormatters';
import { formattedValueToString } from './valueFormats';
import { toUtc, dateTime } from '../datetime/moment_wrapper';

describe('date time formats', () => {
  const epoch = 1505634997920;
  const utcTime = toUtc(epoch);
  const browserTime = dateTime(epoch);

  it('should format as iso date', () => {
    const expected = browserTime.format('YYYY-MM-DD HH:mm:ss');
    const actual = dateTimeAsIso(epoch, 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as iso date (in UTC)', () => {
    const expected = utcTime.format('YYYY-MM-DD HH:mm:ss');
    const actual = dateTimeAsIso(epoch, 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });

  it('should format as iso date and skip date when today', () => {
    const now = dateTime();
    const expected = now.format('HH:mm:ss');
    const actual = dateTimeAsIsoNoDateIfToday(now.valueOf(), 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as iso date (in UTC) and skip date when today', () => {
    const now = toUtc();
    const expected = now.format('HH:mm:ss');
    const actual = dateTimeAsIsoNoDateIfToday(now.valueOf(), 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });

  it('should format as US date', () => {
    const expected = browserTime.format('MM/DD/YYYY h:mm:ss a');
    const actual = dateTimeAsUS(epoch, 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as US date (in UTC)', () => {
    const expected = utcTime.format('MM/DD/YYYY h:mm:ss a');
    const actual = dateTimeAsUS(epoch, 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });

  it('should format as US date and skip date when today', () => {
    const now = dateTime();
    const expected = now.format('h:mm:ss a');
    const actual = dateTimeAsUSNoDateIfToday(now.valueOf(), 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as US date (in UTC) and skip date when today', () => {
    const now = toUtc();
    const expected = now.format('h:mm:ss a');
    const actual = dateTimeAsUSNoDateIfToday(now.valueOf(), 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });

  it('should format as from now with days', () => {
    const daysAgo = dateTime().add(-7, 'd');
    const expected = '7 days ago';
    const actual = dateTimeFromNow(daysAgo.valueOf(), 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as from now with days (in UTC)', () => {
    const daysAgo = toUtc().add(-7, 'd');
    const expected = '7 days ago';
    const actual = dateTimeFromNow(daysAgo.valueOf(), 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });

  it('should format as from now with minutes', () => {
    const daysAgo = dateTime().add(-2, 'm');
    const expected = '2 minutes ago';
    const actual = dateTimeFromNow(daysAgo.valueOf(), 0, 0);
    expect(actual.text).toBe(expected);
  });

  it('should format as from now with minutes (in UTC)', () => {
    const daysAgo = toUtc().add(-2, 'm');
    const expected = '2 minutes ago';
    const actual = dateTimeFromNow(daysAgo.valueOf(), 0, 0, 'utc');
    expect(actual.text).toBe(expected);
  });
});

describe('duration', () => {
  it('0 milliseconds', () => {
    const str = toDurationInMilliseconds(0, 0);
    expect(formattedValueToString(str)).toBe('0 milliseconds');
  });
  it('1 millisecond', () => {
    const str = toDurationInMilliseconds(1, 0);
    expect(formattedValueToString(str)).toBe('1 millisecond');
  });
  it('-1 millisecond', () => {
    const str = toDurationInMilliseconds(-1, 0);
    expect(formattedValueToString(str)).toBe('1 millisecond ago');
  });
  it('seconds', () => {
    const str = toDurationInSeconds(1, 0);
    expect(formattedValueToString(str)).toBe('1 second');
  });
  it('minutes', () => {
    const str = toDuration(1, 0, Interval.Minute);
    expect(formattedValueToString(str)).toBe('1 minute');
  });
  it('hours', () => {
    const str = toDuration(1, 0, Interval.Hour);
    expect(formattedValueToString(str)).toBe('1 hour');
  });
  it('days', () => {
    const str = toDuration(1, 0, Interval.Day);
    expect(formattedValueToString(str)).toBe('1 day');
  });
  it('weeks', () => {
    const str = toDuration(1, 0, Interval.Week);
    expect(formattedValueToString(str)).toBe('1 week');
  });
  it('months', () => {
    const str = toDuration(1, 0, Interval.Month);
    expect(formattedValueToString(str)).toBe('1 month');
  });
  it('years', () => {
    const str = toDuration(1, 0, Interval.Year);
    expect(formattedValueToString(str)).toBe('1 year');
  });
  it('decimal days', () => {
    const str = toDuration(1.5, 2, Interval.Day);
    expect(formattedValueToString(str)).toBe('1 day, 12 hours, 0 minutes');
  });
  it('decimal months', () => {
    const str = toDuration(1.5, 3, Interval.Month);
    expect(formattedValueToString(str)).toBe('1 month, 2 weeks, 1 day, 0 hours');
  });
  it('no decimals', () => {
    const str = toDuration(38898367008, 0, Interval.Millisecond);
    expect(formattedValueToString(str)).toBe('1 year');
  });
  it('1 decimal', () => {
    const str = toDuration(38898367008, 1, Interval.Millisecond);
    expect(formattedValueToString(str)).toBe('1 year, 2 months');
  });
  it('too many decimals', () => {
    const str = toDuration(38898367008, 20, Interval.Millisecond);
    expect(formattedValueToString(str)).toBe(
      '1 year, 2 months, 3 weeks, 4 days, 5 hours, 6 minutes, 7 seconds, 8 milliseconds'
    );
  });
  it('floating point error', () => {
    const str = toDuration(36993906007, 8, Interval.Millisecond);
    expect(formattedValueToString(str)).toBe(
      '1 year, 2 months, 0 weeks, 3 days, 4 hours, 5 minutes, 6 seconds, 7 milliseconds'
    );
  });
  it('1 dthms', () => {
    const str = toDurationInHoursMinutesSeconds(1);
    expect(formattedValueToString(str)).toBe('00:00:01');
  });
  it('-1 dthms', () => {
    const str = toDurationInHoursMinutesSeconds(-1);
    expect(formattedValueToString(str)).toBe('00:00:01 ago');
  });
  it('0 dthms', () => {
    const str = toDurationInHoursMinutesSeconds(0);
    expect(formattedValueToString(str)).toBe('00:00:00');
  });
  it('1 dtdhms', () => {
    const str = toDurationInHoursMinutesSeconds(1);
    expect(formattedValueToString(str)).toBe('00:00:01');
  });
  it('-1 dtdhms', () => {
    const str = toDurationInHoursMinutesSeconds(-1);
    expect(formattedValueToString(str)).toBe('00:00:01 ago');
  });
  it('0 dtdhms', () => {
    const str = toDurationInHoursMinutesSeconds(0);
    expect(formattedValueToString(str)).toBe('00:00:00');
  });
  it('86399 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(86399);
    expect(formattedValueToString(str)).toBe('23:59:59');
  });
  it('86400 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(86400);
    expect(formattedValueToString(str)).toBe('1 d 00:00:00');
  });
  it('360000 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(360000);
    expect(formattedValueToString(str)).toBe('4 d 04:00:00');
  });
  it('1179811 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(1179811);
    expect(formattedValueToString(str)).toBe('13 d 15:43:31');
  });
  it('-1179811 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(-1179811);
    expect(formattedValueToString(str)).toBe('13 d 15:43:31 ago');
  });
  it('116876364 dtdhms', () => {
    const str = toDurationInDaysHoursMinutesSeconds(116876364);
    expect(formattedValueToString(str)).toBe('1352 d 17:39:24');
  });
});

describe('clock', () => {
  it('size less than 1 second', () => {
    const str = toClock(999, 0);
    expect(formattedValueToString(str)).toBe('999ms');
  });
  describe('size less than 1 minute', () => {
    it('default', () => {
      const str = toClock(59999);
      expect(formattedValueToString(str)).toBe('59s:999ms');
    });
    it('decimals equals 0', () => {
      const str = toClock(59999, 0);
      expect(formattedValueToString(str)).toBe('59s');
    });
  });
  describe('size less than 1 hour', () => {
    it('default', () => {
      const str = toClock(3599999);
      expect(formattedValueToString(str)).toBe('59m:59s:999ms');
    });
    it('decimals equals 0', () => {
      const str = toClock(3599999, 0);
      expect(formattedValueToString(str)).toBe('59m');
    });
    it('decimals equals 1', () => {
      const str = toClock(3599999, 1);
      expect(formattedValueToString(str)).toBe('59m:59s');
    });
  });
  describe('size greater than or equal 1 hour', () => {
    it('default', () => {
      const str = toClock(7199999);
      expect(formattedValueToString(str)).toBe('01h:59m:59s:999ms');
    });
    it('decimals equals 0', () => {
      const str = toClock(7199999, 0);
      expect(formattedValueToString(str)).toBe('01h');
    });
    it('decimals equals 1', () => {
      const str = toClock(7199999, 1);
      expect(formattedValueToString(str)).toBe('01h:59m');
    });
    it('decimals equals 2', () => {
      const str = toClock(7199999, 2);
      expect(formattedValueToString(str)).toBe('01h:59m:59s');
    });
  });
  describe('size greater than or equal 1 day', () => {
    it('default', () => {
      const str = toClock(89999999);
      expect(formattedValueToString(str)).toBe('24h:59m:59s:999ms');
    });
    it('decimals equals 0', () => {
      const str = toClock(89999999, 0);
      expect(formattedValueToString(str)).toBe('24h');
    });
    it('decimals equals 1', () => {
      const str = toClock(89999999, 1);
      expect(formattedValueToString(str)).toBe('24h:59m');
    });
    it('decimals equals 2', () => {
      const str = toClock(89999999, 2);
      expect(formattedValueToString(str)).toBe('24h:59m:59s');
    });
  });
});

describe('to nanoseconds', () => {
  it('should correctly display as ns', () => {
    const tenNanoseconds = toNanoSeconds(10);
    expect(tenNanoseconds.text).toBe('10');
    expect(tenNanoseconds.suffix).toBe(' ns');
  });

  it('should correctly display as µs', () => {
    const threeMicroseconds = toNanoSeconds(3000);
    expect(threeMicroseconds.text).toBe('3');
    expect(threeMicroseconds.suffix).toBe(' µs');
  });

  it('should correctly display as ms', () => {
    const fourMilliseconds = toNanoSeconds(4000000);
    expect(fourMilliseconds.text).toBe('4');
    expect(fourMilliseconds.suffix).toBe(' ms');
  });

  it('should correctly display as s', () => {
    const fiveSeconds = toNanoSeconds(5000000000);
    expect(fiveSeconds.text).toBe('5');
    expect(fiveSeconds.suffix).toBe(' s');
  });

  it('should correctly display as minutes', () => {
    const eightMinutes = toNanoSeconds(480000000000);
    expect(eightMinutes.text).toBe('8');
    expect(eightMinutes.suffix).toBe(' min');
  });

  it('should correctly display as hours', () => {
    const nineHours = toNanoSeconds(32400000000000);
    expect(nineHours.text).toBe('9');
    expect(nineHours.suffix).toBe(' hour');
  });

  it('should correctly display as days', () => {
    const tenDays = toNanoSeconds(864000000000000);
    expect(tenDays.text).toBe('10');
    expect(tenDays.suffix).toBe(' day');
  });
});

describe('seconds', () => {
  it('should show 0 as 0', () => {
    const zeroSeconds = toSeconds(0);
    expect(zeroSeconds.text).toBe('0');
    expect(zeroSeconds.suffix).toBe(' s');
  });
});
