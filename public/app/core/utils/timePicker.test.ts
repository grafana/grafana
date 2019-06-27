import { RawTimeRange, toUtc } from '@grafana/ui';

import { getShiftedTimeRange } from './timePicker';

export const expectRangesAreSame = (rawRange1: RawTimeRange, rawRange2: RawTimeRange) => {
  expect(rawRange1.from.valueOf()).toEqual(rawRange2.from.valueOf());
  expect(rawRange1.to.valueOf()).toEqual(rawRange2.to.valueOf());
};

export const setup = (options?: any) => {
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
    timeZone: '',
  };

  return { ...defaultOptions, ...options };
};

describe('getShiftedTimeRange', () => {
  describe('when called with a direction of -1', () => {
    describe('and browser TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: -1, timeZone: 'browser' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 07:00:00'),
          to: toUtc('2019-01-01 13:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);

        expectRangesAreSame(expectedRange, result);
      });
    });

    describe('and UTC TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: -1, timeZone: 'utc' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 07:00:00'),
          to: toUtc('2019-01-01 13:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);
        expectRangesAreSame(expectedRange, result);
      });
    });
  });

  describe('when called with a direction of 1', () => {
    describe('and browser TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: 1, timeZone: 'browser' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 13:00:00'),
          to: toUtc('2019-01-01 19:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);

        expectRangesAreSame(expectedRange, result);
      });
    });

    describe('and UTC TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: 1, timeZone: 'utc' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 13:00:00'),
          to: toUtc('2019-01-01 19:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);

        expectRangesAreSame(expectedRange, result);
      });
    });
  });

  describe('when called with any other direction', () => {
    describe('and browser TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: 0, timeZone: 'browser' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 10:00:00'),
          to: toUtc('2019-01-01 16:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);

        expectRangesAreSame(expectedRange, result);
      });
    });

    describe('and UTC TimeZone', () => {
      it('then it should return correct result', () => {
        const { range, direction, timeZone } = setup({ direction: 0, timeZone: 'utc' });
        const expectedRange: RawTimeRange = {
          from: toUtc('2019-01-01 10:00:00'),
          to: toUtc('2019-01-01 16:00:00'),
        };

        const result = getShiftedTimeRange(direction, range, timeZone);

        expectRangesAreSame(expectedRange, result);
      });
    });
  });
});
