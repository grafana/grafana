import { dateTime, TimeRange } from '@grafana/data';
import { convertToCron, TimeRegionConfig } from 'app/core/utils/timeRegions';

import { calculateTimesWithin } from './timeRegions';

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

  /*
  from, from dow, to, to dow, timezone, duration
    
  */

  describe('convert simple time region config to cron string and duration', () => {
    it.each`
      from       | fromDOW | to         | toDOW | timezone     | expectedCron   | expectedDuration
      ${'03:03'} | ${1}    | ${'03:03'} | ${2}  | ${'browser'} | ${'3 3 * * 0'} | ${'1d'}
      ${'03:03'} | ${7}    | ${'03:03'} | ${1}  | ${'browser'} | ${'3 3 * * 6'} | ${'1d'}
      ${'03:03'} | ${7}    | ${'04:03'} | ${7}  | ${'browser'} | ${'3 3 * * 6'} | ${'1h'}
      ${'03:03'} | ${7}    | ${'02:03'} | ${7}  | ${'browser'} | ${'3 3 * * 6'} | ${'6d 23h'}
    `(
      "time region config with from time '$from' and DOW '$fromDOW', to: '$to' and DOW '$toDOW' should generate a cron string of '$expectedCron' and '$expectedDuration'",
      ({ from, fromDOW, to, toDOW, timezone, expectedCron, expectedDuration }) => {
        const timeConfig: TimeRegionConfig = { from, fromDayOfWeek: fromDOW, to, toDayOfWeek: toDOW, timezone };
        const convertedCron = convertToCron(timeConfig);
        expect(convertedCron).not.toBeUndefined();
        expect(convertedCron!.cron).toEqual(expectedCron);
        expect(convertedCron!.duration).toEqual(expectedDuration);
      }
    );
  });
});
