import * as ticks from '../utils/ticks';

describe('ticks', () => {
  describe('getStringPrecision()', () => {
    it('"3.12" should return 2', () => {
      expect(ticks.getStringPrecision('3.12')).toBe(2);
    });
    it('"asd" should return 0', () => {
      expect(ticks.getStringPrecision('asd.asd')).toBe(0);
    });
  });
});
