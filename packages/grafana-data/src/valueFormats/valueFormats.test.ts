import { toFixed, getValueFormat, scaledUnits } from './valueFormats';

describe('valueFormats', () => {
  describe('format edge cases', () => {
    const negInf = Number.NEGATIVE_INFINITY.toLocaleString();
    const posInf = Number.POSITIVE_INFINITY.toLocaleString();

    it('toFixed should handle non number input gracefully', () => {
      expect(toFixed(NaN)).toBe('NaN');
      expect(toFixed(Number.NEGATIVE_INFINITY)).toBe(negInf);
      expect(toFixed(Number.POSITIVE_INFINITY)).toBe(posInf);
    });

    it('scaledUnits should handle non number input gracefully', () => {
      const disp = scaledUnits(5, ['a', 'b', 'c']);
      expect(disp(NaN)).toBe('NaN');
      expect(disp(Number.NEGATIVE_INFINITY)).toBe(negInf);
      expect(disp(Number.POSITIVE_INFINITY)).toBe(posInf);
    });
  });

  describe('toFixed and negative decimals', () => {
    it('should treat as zero decimals', () => {
      const str = toFixed(186.123, -2);
      expect(str).toBe('186');
    });
  });

  describe('ms format when scaled decimals is null do not use it', () => {
    it('should use specified decimals', () => {
      const str = getValueFormat('ms')(10000086.123, 1, null);
      expect(str).toBe('2.8 hour');
    });
  });

  describe('kbytes format when scaled decimals is null do not use it', () => {
    it('should use specified decimals', () => {
      const str = getValueFormat('kbytes')(10000000, 3, null);
      expect(str).toBe('9.537 GiB');
    });
  });

  describe('deckbytes format when scaled decimals is null do not use it', () => {
    it('should use specified decimals', () => {
      const str = getValueFormat('deckbytes')(10000000, 3, null);
      expect(str).toBe('10.000 GB');
    });
  });

  describe('ms format when scaled decimals is 0', () => {
    it('should use scaledDecimals and add 3', () => {
      const str = getValueFormat('ms')(1200, 0, 0);
      expect(str).toBe('1.200 s');
    });
  });

  describe('Resolve old units', () => {
    it('resolve farenheit', () => {
      const fmt0 = getValueFormat('farenheit');
      const fmt1 = getValueFormat('fahrenheit');
      expect(fmt0).toEqual(fmt1);
    });
  });
});
