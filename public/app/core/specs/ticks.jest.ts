import * as ticks from '../utils/ticks';

describe('ticks', () => {
  describe('getFlotTickDecimals()', () => {
    let ctx: any = {};

    beforeEach(() => {
      ctx.axis = {};
    });

    it('should calculate decimals precision based on graph height', () => {
      let dec = ticks.getFlotTickDecimals(0, 10, ctx.axis, 200);
      expect(dec.tickDecimals).toBe(1);
      expect(dec.scaledDecimals).toBe(1);

      dec = ticks.getFlotTickDecimals(0, 100, ctx.axis, 200);
      expect(dec.tickDecimals).toBe(0);
      expect(dec.scaledDecimals).toBe(-1);

      dec = ticks.getFlotTickDecimals(0, 1, ctx.axis, 200);
      expect(dec.tickDecimals).toBe(2);
      expect(dec.scaledDecimals).toBe(3);
    });
  });

  describe('getDecimalsForValue()', () => {
    it('should calculate reasonable decimals precision for given value', () => {
      expect(ticks.getDecimalsForValue(1.01)).toEqual({ decimals: 1, scaledDecimals: 4 });
      expect(ticks.getDecimalsForValue(9.01)).toEqual({ decimals: 0, scaledDecimals: 2 });
      expect(ticks.getDecimalsForValue(1.1)).toEqual({ decimals: 1, scaledDecimals: 4 });
      expect(ticks.getDecimalsForValue(2)).toEqual({ decimals: 0, scaledDecimals: 2 });
      expect(ticks.getDecimalsForValue(20)).toEqual({ decimals: 0, scaledDecimals: 1 });
      expect(ticks.getDecimalsForValue(200)).toEqual({ decimals: 0, scaledDecimals: 0 });
      expect(ticks.getDecimalsForValue(2000)).toEqual({ decimals: 0, scaledDecimals: 0 });
      expect(ticks.getDecimalsForValue(20000)).toEqual({ decimals: 0, scaledDecimals: -2 });
      expect(ticks.getDecimalsForValue(200000)).toEqual({ decimals: 0, scaledDecimals: -3 });
      expect(ticks.getDecimalsForValue(200000000)).toEqual({ decimals: 0, scaledDecimals: -6 });
    });
  });
});
