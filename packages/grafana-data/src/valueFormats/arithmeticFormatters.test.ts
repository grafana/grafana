import { sci, toHex, toHex0x, toPercent, toPercentUnit } from './arithmeticFormatters';
import { formattedValueToString } from './valueFormats';

describe('scientific formatting', () => {
  describe('sci', () => {
    it('follows the sad path as expected', () => {
      const str = sci(null, 0);
      expect(formattedValueToString(str)).toBe('');
    });
    it('renders the correct postive scientific notation as expected', () => {
      const str = sci(1000, 0);
      expect(formattedValueToString(str)).toBe('1e+3');
    });
    it('renders the correct nagative scientific notation as expected', () => {
      const str = sci(-1000, 0);
      expect(formattedValueToString(str)).toBe('-1e+3');
    });
    it('renders the correct decimal scientific notation as expected', () => {
      const str = sci(1000, 2);
      expect(formattedValueToString(str)).toBe('1.00e+3');
    });
  });
});

describe('hexadecimal formatting', () => {
  describe('toHex', () => {
    it('follows the sad path as expected', () => {
      const str = toHex(null, 0);
      expect(formattedValueToString(str)).toBe('');
    });
    it('renders a positive integer', () => {
      const str = toHex(100, 0);
      expect(formattedValueToString(str)).toBe('64');
    });
    it('negative integer', () => {
      const str = toHex(-100, 0);
      expect(formattedValueToString(str)).toBe('-64');
    });
    it('positive float', () => {
      const str = toHex(50.52, 1);
      expect(formattedValueToString(str)).toBe('32.8');
    });
    it('negative float', () => {
      const str = toHex(-50.333, 2);
      expect(formattedValueToString(str)).toBe('-32.547AE147AE14');
    });
  });
  describe('toHex0x', () => {
    it('follows the sad path as expected', () => {
      const str = toHex0x(null, 0);
      expect(formattedValueToString(str)).toBe('');
    });
    it('positive integer', () => {
      const str = toHex0x(7999, 0);
      expect(formattedValueToString(str)).toBe('0x1F3F');
    });
    it('negative integer', () => {
      const str = toHex0x(-584, 0);
      expect(formattedValueToString(str)).toBe('-0x248');
    });

    it('positive float', () => {
      const str = toHex0x(74.443, 3);
      expect(formattedValueToString(str)).toBe('0x4A.716872B020C4');
    });
    it('negative float', () => {
      const str = toHex0x(-65.458, 1);
      expect(formattedValueToString(str)).toBe('-0x41.8');
    });
  });
});

describe('percentage formatting', () => {
  const size = 33.33333;
  const decimals = 2;
  describe('toPercent', () => {
    it('follows the sad path as expected', () => {
      const str = toPercent(null, decimals);
      expect(formattedValueToString(str)).toBe('');
    });
    it('renders a percent as expected', () => {
      const str = toPercent(size, 2);
      expect(formattedValueToString(str)).toBe('33.33%');
    });
  });
  describe('toPercentUnit', () => {
    it('follows the sad path as expected', () => {
      const str = toPercentUnit(null, decimals);
      expect(formattedValueToString(str)).toBe('');
    });
    it('renders a percent unit as expected', () => {
      const str = toPercentUnit(size, 2);
      expect(formattedValueToString(str)).toBe('3333.33%');
    });
  });
});
