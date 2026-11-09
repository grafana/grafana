import { dateTime, toUtc, type AbsoluteTimeRange, type TimeRange } from '@grafana/data';

import { getShiftedTimeRange, getZoomedTimeRange, parseUrlTime } from './timePicker';

export const setup = (options?: { direction?: number; range?: TimeRange }) => {
  const defaultOptions = {
    range: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    direction: 0,
  };

  return { ...defaultOptions, ...options };
};

describe('getShiftedTimeRange', () => {
  describe('when called with a direction of -1', () => {
    it('then it should return correct result', () => {
      const { range, direction } = setup({ direction: -1 });
      const expectedRange: AbsoluteTimeRange = {
        from: toUtc('2019-01-01 07:00:00').valueOf(),
        to: toUtc('2019-01-01 13:00:00').valueOf(),
      };

      const result = getShiftedTimeRange(direction, range);

      expect(result).toEqual(expectedRange);
    });
  });

  describe('when called with a direction of 1', () => {
    it('then it should return correct result', () => {
      const { range, direction } = setup({ direction: 1 });
      const expectedRange: AbsoluteTimeRange = {
        from: toUtc('2019-01-01 13:00:00').valueOf(),
        to: toUtc('2019-01-01 19:00:00').valueOf(),
      };

      const result = getShiftedTimeRange(direction, range);

      expect(result).toEqual(expectedRange);
    });
  });

  describe('when called with any other direction', () => {
    it('then it should return correct result', () => {
      const { range, direction } = setup({ direction: 0 });
      const expectedRange: AbsoluteTimeRange = {
        from: toUtc('2019-01-01 10:00:00').valueOf(),
        to: toUtc('2019-01-01 16:00:00').valueOf(),
      };

      const result = getShiftedTimeRange(direction, range);

      expect(result).toEqual(expectedRange);
    });
  });
});

describe('getZoomedTimeRange', () => {
  describe('when called', () => {
    it('then it should return correct result', () => {
      const { range } = setup();
      const expectedRange: AbsoluteTimeRange = {
        from: toUtc('2019-01-01 07:00:00').valueOf(),
        to: toUtc('2019-01-01 19:00:00').valueOf(),
      };

      const result = getZoomedTimeRange(range, 2);

      expect(result).toEqual(expectedRange);
    });
  });
  describe('when called with a timespan of 0', () => {
    it('then it should return a timespan of 30s', () => {
      const range = {
        from: toUtc('2019-01-01 10:00:00'),
        to: toUtc('2019-01-01 10:00:00'),
        raw: {
          from: 'now',
          to: 'now',
        },
      };
      const expectedRange: AbsoluteTimeRange = {
        from: toUtc('2019-01-01 09:59:45').valueOf(),
        to: toUtc('2019-01-01 10:00:15').valueOf(),
      };

      const result = getZoomedTimeRange(range, 2);

      expect(result).toEqual(expectedRange);
    });
  });
});

describe('parseUrlTime', () => {
  const instant = dateTime('2024-05-29T16:26:40Z').valueOf();

  it('keeps relative expressions as text', () => {
    expect(parseUrlTime('now-6h')).toBe('now-6h');
    expect(parseUrlTime('now/d')).toBe('now/d');
  });

  it.each([
    ['epoch ms', String(instant)],
    ['ISO 8601', '2024-05-29T16:26:40.000Z'],
    ['YYYYMMDDTHHmmss', '20240529T162640'],
    ['YYYY-MM-DD HH:mm:ss', '2024-05-29 16:26:40'],
  ])('parses %s as UTC', (_, value) => {
    expect(parseUrlTime(value)?.valueOf()).toBe(instant);
  });

  it('parses the compact date form at midnight UTC', () => {
    expect(parseUrlTime('20240529')?.valueOf()).toBe(dateTime('2024-05-29T00:00:00Z').valueOf());
  });

  it.each(['', 'yesterday', 'abcdefgh', '2024-13-45 99:99:99'])('returns null for %p', (value) => {
    expect(parseUrlTime(value)).toBeNull();
  });
});
