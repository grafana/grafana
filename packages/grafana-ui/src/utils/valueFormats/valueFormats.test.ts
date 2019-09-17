import { toFixed, getValueFormat } from './valueFormats';

describe('valueFormats', () => {
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
});
