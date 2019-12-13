import { pairsAreValid } from './InfluxLogsQueryField';

describe('pairsAreValid()', () => {
  describe('when all pairs are fully defined', () => {
    it('should return true', () => {
      const pairs = [
        {
          key: 'a',
          operator: '=',
          value: '1',
        },
        {
          key: 'b',
          operator: '!=',
          value: '2',
        },
      ];

      expect(pairsAreValid(pairs as any)).toBe(true);
    });
  });

  describe('when no pairs are defined at all', () => {
    it('should return true', () => {
      expect(pairsAreValid([])).toBe(true);
    });
  });

  describe('when pairs are undefined', () => {
    it('should return true', () => {
      expect(pairsAreValid(undefined)).toBe(true);
    });
  });

  describe('when one or more pairs are only partially defined', () => {
    it('should return false', () => {
      const pairs = [
        {
          key: 'a',
          operator: undefined,
          value: '1',
        },
        {
          key: 'b',
          operator: '!=',
          value: '2',
        },
      ];

      expect(pairsAreValid(pairs as any)).toBe(false);
    });
  });
});
