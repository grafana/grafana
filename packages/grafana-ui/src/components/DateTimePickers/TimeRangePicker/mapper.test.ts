import { type DateTime, dateTimeParse } from '@grafana/data';

import { mapOptionToTimeRange, mapRangeToTimeOption } from './mapper';

describe('when mapOptionToTimeRange is passed a TimeOption and timezone', () => {
  it('returns the equivalent TimeRange', () => {
    const result = mapOptionToTimeRange(
      {
        from: '2025-04-13 04:13:14',
        to: '2025-04-13 05:14:15',
        display: '13/04/25, 4:13:14 am - 5:14:15 am',
      },
      'America/New_York'
    );

    function toISOStringIfDate(date: string | DateTime) {
      return typeof date === 'string' ? date : date.toISOString();
    }
    expect(result.from.toISOString()).toBe('2025-04-13T08:13:14.000Z');
    expect(result.to.toISOString()).toBe('2025-04-13T09:14:15.000Z');
    expect(toISOStringIfDate(result.raw.from)).toBe('2025-04-13T08:13:14.000Z');
    expect(toISOStringIfDate(result.raw.to)).toBe('2025-04-13T09:14:15.000Z');
  });
});

describe('when mapRangeToTimeOption is passed a TimeRange and timezone', () => {
  it('returns the equivalent TimeOption', () => {
    expect(
      mapRangeToTimeOption(
        {
          from: dateTimeParse('2025-04-13T08:13:14Z'),
          to: dateTimeParse('2025-04-13T09:14:15Z'),
          raw: {
            from: dateTimeParse('2025-04-13T08:13:14Z'),
            to: dateTimeParse('2025-04-13T09:14:15Z'),
          },
        },
        'America/New_York'
      )
    ).toStrictEqual({
      from: '2025-04-13 04:13:14',
      to: '2025-04-13 05:14:15',
      display: '2025-04-13 04:13:14 to 2025-04-13 05:14:15',
    });
  });
});
