import { Duration } from 'date-fns';

import { AbsoluteTimeRange, dateTimeForTimeZone, reverseParseDuration, TimeRange } from '@grafana/data';
import { convertToCron, TimeRegionConfig } from 'app/core/utils/timeRegions';

import { calculateTimesWithin } from './timeRegions';

// random from the interwebs
function durationFromSeconds(seconds: number): Duration {
  const secondsInYear = 31536000;
  const secondsInMonth = 2628000;
  const secondsInDay = 86400;
  const secondsInHour = 3600;
  const secondsInMinute = 60;

  let years = Math.floor(seconds / secondsInYear);
  let remainingSeconds = seconds % secondsInYear;

  let months = Math.floor(remainingSeconds / secondsInMonth);
  remainingSeconds %= secondsInMonth;

  let days = Math.floor(remainingSeconds / secondsInDay);
  remainingSeconds %= secondsInDay;

  let hours = Math.floor(remainingSeconds / secondsInHour);
  remainingSeconds %= secondsInHour;

  let minutes = Math.floor(remainingSeconds / secondsInMinute);
  let finalSeconds = remainingSeconds % secondsInMinute;

  return {
    years,
    months,
    days,
    hours,
    minutes,
    seconds: finalSeconds,
  };
}

function tsToDayOfWeek(ts: number, tz?: string) {
  return new Date(ts).toLocaleString('en', {
    timeZone: tz,
    weekday: 'short',
  });
}

function tsToDateTimeString(ts: number, tz?: string) {
  return new Date(ts).toLocaleString('sv', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
}

function formatAbsoluteRange(range: AbsoluteTimeRange, tz?: string) {
  return {
    fr: `${tsToDayOfWeek(range.from, tz)} | ${tsToDateTimeString(range.from, tz)}`.replaceAll('−', '-'),
    to: `${tsToDayOfWeek(range.to, tz)} | ${tsToDateTimeString(range.to, tz)}`.replaceAll('−', '-'),
  };
}

/*
// valid test scenarios

with tz / without tz
tz-matches / tz-mismatches

point annos
  from every day (no time)
  from every day (time)
  from tues      (no time)
  from tues      (time)

  // matching times
  from every day (time)        to every day (time)
  from tues      (time)        to tues      (time)

region annos
  from every day (time before) to every day (time after)
  from every day (time after)  to every day (time before)
  from every day (no time)     to every day (time)
  from every day (time)        to every day (no time)

  // "to" should assume every day
  from every day               to tues

  from fri (no time)           to tues (no time)
  from fri (no time)           to tues (time)
  from fri (time)              to tues (no time)
  from fri (time)              to tues (time)

  // "to" should assume Fri
  from fri (time before)       to every day (time after)

  from fri (time before)       to fri (time after)
  from fri (time after)        to fri (time before)
*/

describe('timeRegions', () => {
  describe('day of week', () => {
    it('returns regions with 4 Mondays in March 2023', () => {
      const dashboardTz = 'America/Chicago';
      const regionsTz = dashboardTz;

      const cfg: TimeRegionConfig = {
        timezone: regionsTz,
        fromDayOfWeek: 1,
      };

      const tr: TimeRange = {
        from: dateTimeForTimeZone(dashboardTz, '2023-03-01'),
        to: dateTimeForTimeZone(dashboardTz, '2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      const formatted = regions.map((r) => formatAbsoluteRange(r, regionsTz));
      expect(formatted).toEqual([
        {
          fr: 'Mon | 2023-03-06 00:00:00 GMT-6',
          to: 'Tue | 2023-03-07 00:00:00 GMT-6',
        },
        {
          fr: 'Mon | 2023-03-13 00:00:00 GMT-5',
          to: 'Tue | 2023-03-14 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-20 00:00:00 GMT-5',
          to: 'Tue | 2023-03-21 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-27 00:00:00 GMT-5',
          to: 'Tue | 2023-03-28 00:00:00 GMT-5',
        },
      ]);
    });
  });
  describe('day and time of week', () => {
    it('returns regions with 4 Mondays at 20:00 in March 2023', () => {
      const dashboardTz = 'America/Chicago';
      const regionsTz = dashboardTz;

      const cfg: TimeRegionConfig = {
        timezone: regionsTz,
        fromDayOfWeek: 1,
        from: '20:00',
      };

      const tr: TimeRange = {
        from: dateTimeForTimeZone(dashboardTz, '2023-03-01'),
        to: dateTimeForTimeZone(dashboardTz, '2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      const formatted = regions.map((r) => formatAbsoluteRange(r, regionsTz));
      expect(formatted).toEqual([
        {
          fr: 'Mon | 2023-03-06 20:00:00 GMT-6',
          to: 'Mon | 2023-03-06 20:00:00 GMT-6',
        },
        {
          fr: 'Mon | 2023-03-13 20:00:00 GMT-5',
          to: 'Mon | 2023-03-13 20:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-20 20:00:00 GMT-5',
          to: 'Mon | 2023-03-20 20:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-27 20:00:00 GMT-5',
          to: 'Mon | 2023-03-27 20:00:00 GMT-5',
        },
      ]);
    });
  });
  describe('day of week range', () => {
    it('returns regions with days range', () => {
      const dashboardTz = 'America/Chicago';
      const regionsTz = dashboardTz;

      const cfg: TimeRegionConfig = {
        timezone: regionsTz,
        fromDayOfWeek: 1,
        toDayOfWeek: 3,
      };

      const tr: TimeRange = {
        from: dateTimeForTimeZone(dashboardTz, '2023-03-01'),
        to: dateTimeForTimeZone(dashboardTz, '2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      const formatted = regions.map((r) => formatAbsoluteRange(r, regionsTz));
      expect(formatted).toEqual([
        {
          fr: 'Mon | 2023-02-27 00:00:00 GMT-6',
          to: 'Thu | 2023-03-02 00:00:00 GMT-6',
        },
        {
          fr: 'Mon | 2023-03-06 00:00:00 GMT-6',
          to: 'Thu | 2023-03-09 00:00:00 GMT-6',
        },
        {
          fr: 'Mon | 2023-03-13 00:00:00 GMT-5',
          to: 'Thu | 2023-03-16 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-20 00:00:00 GMT-5',
          to: 'Thu | 2023-03-23 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-27 00:00:00 GMT-5',
          to: 'Thu | 2023-03-30 00:00:00 GMT-5',
        },
      ]);
    });

    it('returns regions with days range (browser time zone)', () => {
      const dashboardTz = process.env.TZ;
      const regionsTz = dashboardTz;

      const cfg: TimeRegionConfig = {
        timezone: regionsTz,
        fromDayOfWeek: 1,
        toDayOfWeek: 3,
      };

      const tr: TimeRange = {
        from: dateTimeForTimeZone(dashboardTz, '2023-03-01'),
        to: dateTimeForTimeZone(dashboardTz, '2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      const formatted = regions.map((r) => formatAbsoluteRange(r, regionsTz));
      expect(formatted).toEqual([
        {
          fr: 'Mon | 2023-02-27 00:00:00 GMT-5',
          to: 'Thu | 2023-03-02 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-06 00:00:00 GMT-5',
          to: 'Thu | 2023-03-09 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-13 00:00:00 GMT-5',
          to: 'Thu | 2023-03-16 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-20 00:00:00 GMT-5',
          to: 'Thu | 2023-03-23 00:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-27 00:00:00 GMT-5',
          to: 'Thu | 2023-03-30 00:00:00 GMT-5',
        },
      ]);
    });

    it('returns regions with days/times range', () => {
      const dashboardTz = 'America/Chicago';
      const regionsTz = dashboardTz;

      const cfg: TimeRegionConfig = {
        timezone: regionsTz,
        fromDayOfWeek: 1,
        from: '20:00',
        toDayOfWeek: 2,
        to: '10:00',
      };

      const tr: TimeRange = {
        from: dateTimeForTimeZone(dashboardTz, '2023-03-01'),
        to: dateTimeForTimeZone(dashboardTz, '2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      const formatted = regions.map((r) => formatAbsoluteRange(r, regionsTz));
      expect(formatted).toEqual([
        {
          fr: 'Mon | 2023-03-06 20:00:00 GMT-6',
          to: 'Tue | 2023-03-07 10:00:00 GMT-6',
        },
        {
          fr: 'Mon | 2023-03-13 20:00:00 GMT-5',
          to: 'Tue | 2023-03-14 10:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-20 20:00:00 GMT-5',
          to: 'Tue | 2023-03-21 10:00:00 GMT-5',
        },
        {
          fr: 'Mon | 2023-03-27 20:00:00 GMT-5',
          to: 'Tue | 2023-03-28 10:00:00 GMT-5',
        },
      ]);
    });
  });

  describe('convert simple time region config to cron string and duration', () => {
    it.each`
      from       | fromDOW | to         | toDOW | timezone     | expectedCron   | expectedDuration
      ${'03:03'} | ${1}    | ${'03:03'} | ${2}  | ${'browser'} | ${'3 3 * * 1'} | ${'1d'}
      ${'03:03'} | ${7}    | ${'03:03'} | ${1}  | ${'browser'} | ${'3 3 * * 7'} | ${'1d'}
      ${'09:03'} | ${7}    | ${'03:03'} | ${1}  | ${'browser'} | ${'3 9 * * 7'} | ${'18h'}
      ${'03:03'} | ${7}    | ${'04:03'} | ${7}  | ${'browser'} | ${'3 3 * * 7'} | ${'1h'}
      ${'03:03'} | ${7}    | ${'02:03'} | ${7}  | ${'browser'} | ${'3 3 * * 7'} | ${'6d 23h'}
      ${'03:03'} | ${7}    | ${'3:03'}  | ${7}  | ${'browser'} | ${'3 3 * * 7'} | ${''}
    `(
      "time region config with from time '$from' and DOW '$fromDOW', to: '$to' and DOW '$toDOW' should generate a cron string of '$expectedCron' and '$expectedDuration'",
      ({ from, fromDOW, to, toDOW, timezone, expectedCron, expectedDuration }) => {
        const timeConfig: TimeRegionConfig = { from, fromDayOfWeek: fromDOW, to, toDayOfWeek: toDOW, timezone };
        const convertedCron = convertToCron(timeConfig.fromDayOfWeek, timeConfig.from, timeConfig.toDayOfWeek, timeConfig.to)!;
        expect(convertedCron).not.toBeUndefined();
        expect(convertedCron.cronExpr).toEqual(expectedCron);
        expect(reverseParseDuration(durationFromSeconds(convertedCron.duration), false)).toEqual(expectedDuration);
      }
    );
  });
});
