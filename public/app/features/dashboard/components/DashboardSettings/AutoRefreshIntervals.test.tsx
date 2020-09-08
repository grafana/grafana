import { defaultIntervals } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

import { getValidIntervals, validateIntervals } from './AutoRefreshIntervals';
import { TimeSrv } from '../../services/TimeSrv';

describe('getValidIntervals', () => {
  describe('when called with empty intervals', () => {
    it('then is should all non empty intervals', () => {
      const emptyIntervals = ['', '5s', ' ', '10s', '  '];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(emptyIntervals, dependencies);

      expect(result).toEqual(['5s', '10s']);
    });
  });

  describe('when called with duplicate intervals', () => {
    it('then is should return no duplicates', () => {
      const duplicateIntervals = ['5s', '10s', '1m', '5s', '30s', '10s', '5s', '2m'];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(duplicateIntervals, dependencies);

      expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
    });
  });

  describe('when called with untrimmed intervals', () => {
    it('then is should return trimmed intervals', () => {
      const duplicateIntervals = [' 5s', '10s ', ' 1m ', ' 3 0 s ', '   2      m     '];
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = getValidIntervals(duplicateIntervals, dependencies);

      expect(result).toEqual(['5s', '10s', '1m', '30s', '2m']);
    });
  });
});

describe('validateIntervals', () => {
  describe('when getValidIntervals does not throw', () => {
    it('then it should return null', () => {
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: (intervals: any) => intervals,
          } as unknown) as TimeSrv),
      };

      const result = validateIntervals(defaultIntervals, dependencies);

      expect(result).toBe(null);
    });
  });

  describe('when getValidIntervals throws', () => {
    it('then it should return the exception message', () => {
      const dependencies = {
        getTimeSrv: () =>
          (({
            getValidIntervals: () => {
              throw new Error('Some error');
            },
          } as unknown) as TimeSrv),
      };

      const result = validateIntervals(defaultIntervals, dependencies);

      expect(result).toEqual('Some error');
    });
  });
});
