import { dateTime, TimeRange } from '@grafana/data';

import { calculateTimesWithin, TimeRegionConfig } from './timeRegions';

describe('timeRegions', () => {
  describe('day of week', () => {
    it('4 sundays in january 2021', () => {
      const cfg: TimeRegionConfig = {
        fromDayOfWeek: 1,
        from: '12:00',
      };
      const tr: TimeRange = {
        from: dateTime('2021-01-00', 'YYYY-MM-dd'),
        to: dateTime('2021-02-00', 'YYYY-MM-dd'),
        raw: {
          to: '',
          from: '',
        },
      };
      const regions = calculateTimesWithin(cfg, tr);
      expect(regions).toMatchInlineSnapshot(`
        Array [
          Object {
            "from": 1609779600000,
            "to": 1609779600000,
          },
          Object {
            "from": 1610384400000,
            "to": 1610384400000,
          },
          Object {
            "from": 1610989200000,
            "to": 1610989200000,
          },
          Object {
            "from": 1611594000000,
            "to": 1611594000000,
          },
        ]
      `);
    });
  });
});
