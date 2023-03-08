import * as ticks from '../utils/ticks';

describe('ticks', () => {
  describe('getFlotTickDecimals()', () => {
    const axis = {
      min: null,
      max: null,
    };

    it('should calculate decimals precision based on graph height', () => {
      let dec = ticks.getFlotTickDecimals(0, 10, axis, 200);
      expect(dec.tickDecimals).toBe(1);
      expect(dec.scaledDecimals).toBe(1);

      dec = ticks.getFlotTickDecimals(0, 100, axis, 200);
      expect(dec.tickDecimals).toBe(0);
      expect(dec.scaledDecimals).toBe(-1);

      dec = ticks.getFlotTickDecimals(0, 1, axis, 200);
      expect(dec.tickDecimals).toBe(2);
      expect(dec.scaledDecimals).toBe(3);
    });
  });

  describe('getStringPrecision()', () => {
    it('"3.12" should return 2', () => {
      expect(ticks.getStringPrecision('3.12')).toBe(2);
    });
    it('"asd" should return 0', () => {
      expect(ticks.getStringPrecision('asd.asd')).toBe(0);
    });
  });
});
