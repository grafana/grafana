import { Duration } from 'date-fns';

import { dateTime, reverseParseDuration, TimeRange } from '@grafana/data';
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

// note: calculateTimesWithin always returns time ranges in UTC
describe('timeRegions', () => {
  describe.skip('day of week', () => {
    it('returns regions with 4 Mondays in March 2023', () => {
      const cfg: TimeRegionConfig = {
        fromDayOfWeek: 1,
      };

      const tr: TimeRange = {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      expect(regions).toMatchInlineSnapshot(`
        [
          {
            "from": 1678060800000,
            "to": 1678147199000,
          },
          {
            "from": 1678665600000,
            "to": 1678751999000,
          },
          {
            "from": 1679270400000,
            "to": 1679356799000,
          },
          {
            "from": 1679875200000,
            "to": 1679961599000,
          },
        ]
      `);
    });
  });
  describe.skip('day and time of week', () => {
    it('returns regions with 4 Mondays at 20:00 in March 2023', () => {
      const cfg: TimeRegionConfig = {
        fromDayOfWeek: 1,
        from: '20:00',
      };

      const tr: TimeRange = {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      expect(regions).toMatchInlineSnapshot(`
        [
          {
            "from": 1678132800000,
            "to": 1678132800000,
          },
          {
            "from": 1678737600000,
            "to": 1678737600000,
          },
          {
            "from": 1679342400000,
            "to": 1679342400000,
          },
          {
            "from": 1679947200000,
            "to": 1679947200000,
          },
        ]
      `);
    });
  });
  describe.skip('day of week range', () => {
    it('returns regions with days range', () => {
      const cfg: TimeRegionConfig = {
        fromDayOfWeek: 1,
        toDayOfWeek: 3,
      };

      const tr: TimeRange = {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      expect(regions).toMatchInlineSnapshot(`
        [
          {
            "from": 1678060800000,
            "to": 1678319999000,
          },
          {
            "from": 1678665600000,
            "to": 1678924799000,
          },
          {
            "from": 1679270400000,
            "to": 1679529599000,
          },
          {
            "from": 1679875200000,
            "to": 1680134399000,
          },
        ]
      `);
    });
    it('returns regions with days/times range', () => {
      const cfg: TimeRegionConfig = {
        fromDayOfWeek: 1,
        from: '20:00',
        toDayOfWeek: 2,
        to: '10:00',
      };

      const tr: TimeRange = {
        from: dateTime('2023-03-01'),
        to: dateTime('2023-03-31'),
        raw: {
          to: '',
          from: '',
        },
      };

      const regions = calculateTimesWithin(cfg, tr);
      expect(regions).toMatchInlineSnapshot(`
        [
          {
            "from": 1678132800000,
            "to": 1678183200000,
          },
          {
            "from": 1678737600000,
            "to": 1678788000000,
          },
          {
            "from": 1679342400000,
            "to": 1679392800000,
          },
          {
            "from": 1679947200000,
            "to": 1679997600000,
          },
        ]
      `);
    });
  });

  describe('convert simple time region config to cron string and duration', () => {
    it.each`
      from       | fromDOW | to         | toDOW | timezone     | expectedCron   | expectedDuration
      ${'03:03'} | ${1}    | ${'03:03'} | ${2}  | ${'browser'} | ${'3 3 * * 0'} | ${'1d'}
      ${'03:03'} | ${7}    | ${'03:03'} | ${1}  | ${'browser'} | ${'3 3 * * 6'} | ${'1d'}
      ${'09:03'} | ${7}    | ${'03:03'} | ${1}  | ${'browser'} | ${'3 9 * * 6'} | ${'18h'}
      ${'03:03'} | ${7}    | ${'04:03'} | ${7}  | ${'browser'} | ${'3 3 * * 6'} | ${'1h'}
      ${'03:03'} | ${7}    | ${'02:03'} | ${7}  | ${'browser'} | ${'3 3 * * 6'} | ${'6d 23h'}
      ${'03:03'} | ${7}    | ${'3:03'}  | ${7}  | ${'browser'} | ${'3 3 * * 6'} | ${''}
    `(
      "time region config with from time '$from' and DOW '$fromDOW', to: '$to' and DOW '$toDOW' should generate a cron string of '$expectedCron' and '$expectedDuration'",
      ({ from, fromDOW, to, toDOW, timezone, expectedCron, expectedDuration }) => {
        const timeConfig: TimeRegionConfig = { from, fromDayOfWeek: fromDOW, to, toDayOfWeek: toDOW, timezone };
        const convertedCron = convertToCron(timeConfig)!;
        expect(convertedCron).not.toBeUndefined();
        expect(convertedCron.cronExpr).toEqual(expectedCron);
        expect(reverseParseDuration(durationFromSeconds(convertedCron.duration), false)).toEqual(expectedDuration);
      }
    );
  });
});
