import { toUtc, rangeUtil, type AbsoluteTimeRange, type TimeRange } from '@grafana/data';

import { getShiftedTimeRange, getZoomedTimeRange, toUtcDateTimeIfIsoString } from './timePicker';

describe('nanosecond time controls', () => {
  const range = rangeUtil.convertRawToRange({
    from: '1970-01-01T00:00:00.000000100Z',
    to: '1970-01-01T00:00:00.000000300Z',
  });

  it('shifts by half the range without truncating to milliseconds', () => {
    expect(getShiftedTimeRange(1, range)).toEqual({ from: 0, to: 0, fromNano: 200, toNano: 400 });
    expect(getShiftedTimeRange(-1, range)).toEqual({ from: 0, to: 0, toNano: 200 });
  });

  it('zooms a sub-millisecond range without using the zero-duration fallback', () => {
    expect(getZoomedTimeRange(range, 2)).toEqual({ from: 0, to: 0, toNano: 400 });
  });

  it('can move a one-nanosecond range', () => {
    const oneNanosecond = rangeUtil.convertRawToRange({
      from: '1970-01-01T00:00:00.000000001Z',
      to: '1970-01-01T00:00:00.000000002Z',
    });
    expect(getShiftedTimeRange(1, oneNanosecond)).toEqual({ from: 0, to: 0, fromNano: 2, toNano: 3 });
  });

  it('retains nanosecond ISO values when pasting', () => {
    expect(toUtcDateTimeIfIsoString('1970-01-01T00:00:00.000000100Z')).toBe('1970-01-01T00:00:00.000000100Z');
  });
});

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
