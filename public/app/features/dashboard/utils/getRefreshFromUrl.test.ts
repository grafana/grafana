import { getRefreshFromUrl } from './getRefreshFromUrl';

describe('getRefreshFromUrl', () => {
  describe('when refresh is not part of params', () => {
    it('then it should return current refresh value', () => {
      const currentRefresh = false;
      const minRefreshInterval = '5s';
      const isAllowedIntervalFn = () => false;

      const actual = getRefreshFromUrl({
        urlRefresh: null,
        currentRefresh,
        minRefreshInterval,
        isAllowedIntervalFn,
      });

      expect(actual).toBe(false);
    });
  });

  describe('when refresh is part of params', () => {
    describe('and refresh is an existing and valid interval', () => {
      it('then it should return the refresh value', () => {
        const currentRefresh = '';
        const minRefreshInterval = '5s';
        const isAllowedIntervalFn = () => true;
        const refreshIntervals = ['5s', '10s', '30s'];

        const actual = getRefreshFromUrl({
          urlRefresh: '10s',
          currentRefresh,
          minRefreshInterval,
          isAllowedIntervalFn,
          refreshIntervals,
        });

        expect(actual).toBe('10s');
      });
    });

    it.each`
      refresh | isAllowedInterval | minRefreshInterval | refreshIntervals              | expected
      ${'6s'} | ${true}           | ${'1s'}            | ${['5s', '6s', '10s', '30s']} | ${'6s'}
      ${'6s'} | ${true}           | ${'10s'}           | ${['5s', '10s', '30s']}       | ${'10s'}
      ${'6s'} | ${true}           | ${'1s'}            | ${['5s', '10s', '30s']}       | ${'5s'}
      ${'6s'} | ${true}           | ${'1s'}            | ${undefined}                  | ${'5s'}
      ${'6s'} | ${true}           | ${'10s'}           | ${undefined}                  | ${'10s'}
      ${'6s'} | ${true}           | ${'1s'}            | ${[]}                         | ${'currentRefresh'}
      ${'6s'} | ${true}           | ${'10s'}           | ${[]}                         | ${'currentRefresh'}
      ${'6s'} | ${false}          | ${'1s'}            | ${['5s', '6s', '10s', '30s']} | ${'5s'}
      ${'6s'} | ${false}          | ${'10s'}           | ${['5s', '6s', '10s', '30s']} | ${'10s'}
      ${'6s'} | ${false}          | ${'1s'}            | ${['5s', '10s', '30s']}       | ${'5s'}
      ${'6s'} | ${false}          | ${'10s'}           | ${['5s', '10s', '30s']}       | ${'10s'}
      ${'6s'} | ${false}          | ${'1s'}            | ${undefined}                  | ${'5s'}
      ${'6s'} | ${false}          | ${'10s'}           | ${undefined}                  | ${'10s'}
      ${'6s'} | ${false}          | ${'1s'}            | ${[]}                         | ${'currentRefresh'}
      ${'6s'} | ${false}          | ${'10s'}           | ${[]}                         | ${'currentRefresh'}
    `(
      'when called with refresh:{$refresh}, isAllowedInterval:{$isAllowedInterval}, minRefreshInterval:{$minRefreshInterval}, refreshIntervals:{$refreshIntervals} then it should return: $expected',
      ({ refresh, isAllowedInterval, minRefreshInterval, refreshIntervals, expected }) => {
        const actual = getRefreshFromUrl({
          urlRefresh: refresh,
          currentRefresh: 'currentRefresh',
          minRefreshInterval,
          isAllowedIntervalFn: () => isAllowedInterval,
          refreshIntervals,
        });

        expect(actual).toBe(expected);
      }
    );
  });
});
