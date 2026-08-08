import { sci, toHex, toHex0x, toOrdinal, toPercent, toPercentUnit } from './arithmeticFormatters';
import { formattedValueToString } from './baseFormatters';

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

describe('ordinal formatting', () => {
  describe('toOrdinal', () => {
    it('follows the sad path as expected', () => {
      expect(formattedValueToString(toOrdinal(null))).toBe('');
      expect(formattedValueToString(toOrdinal(undefined as unknown as number))).toBe('');
    });

    it.each([
      [0, '0th'],
      [1, '1st'],
      [2, '2nd'],
      [3, '3rd'],
      [4, '4th'],
      [5, '5th'],
      [9, '9th'],
      [10, '10th'],
    ])('renders %p as %p', (value, expected) => {
      expect(formattedValueToString(toOrdinal(value))).toBe(expected);
    });

    it.each([
      [11, '11th'],
      [12, '12th'],
      [13, '13th'],
      [111, '111th'],
      [112, '112th'],
      [113, '113th'],
      [1013, '1013th'],
    ])('renders the teens %p as %p', (value, expected) => {
      expect(formattedValueToString(toOrdinal(value))).toBe(expected);
    });

    it.each([
      [21, '21st'],
      [22, '22nd'],
      [23, '23rd'],
      [101, '101st'],
      [1002, '1002nd'],
      [1000003, '1000003rd'],
    ])('renders %p as %p', (value, expected) => {
      expect(formattedValueToString(toOrdinal(value))).toBe(expected);
    });

    it.each([
      [-1, '-1st'],
      [-2, '-2nd'],
      [-3, '-3rd'],
      [-11, '-11th'],
      [-21, '-21st'],
    ])('renders negative %p as %p', (value, expected) => {
      expect(formattedValueToString(toOrdinal(value))).toBe(expected);
    });

    it('rounds fractional values to the nearest whole number', () => {
      expect(formattedValueToString(toOrdinal(1.4))).toBe('1st');
      expect(formattedValueToString(toOrdinal(1.5))).toBe('2nd');
      expect(formattedValueToString(toOrdinal(2.7))).toBe('3rd');
      expect(formattedValueToString(toOrdinal(10.5))).toBe('11th');
      expect(formattedValueToString(toOrdinal(-0.4))).toBe('0th');
    });

    it('renders non-finite values as plain numbers', () => {
      expect(formattedValueToString(toOrdinal(NaN))).toBe(NaN.toLocaleString());
      expect(formattedValueToString(toOrdinal(Number.POSITIVE_INFINITY))).toBe(
        Number.POSITIVE_INFINITY.toLocaleString()
      );
      expect(formattedValueToString(toOrdinal(Number.NEGATIVE_INFINITY))).toBe(
        Number.NEGATIVE_INFINITY.toLocaleString()
      );
    });
  });
});
