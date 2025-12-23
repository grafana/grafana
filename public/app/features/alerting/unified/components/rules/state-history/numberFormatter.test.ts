import { formatNumericValue } from './numberFormatter';

describe('formatNumericValue', () => {
  describe('Zero and special values', () => {
    it('should format zero correctly', () => {
      expect(formatNumericValue(0)).toBe('0');
      expect(formatNumericValue(-0)).toBe('0');
    });

    it('should handle NaN', () => {
      expect(formatNumericValue(NaN)).toBe('NaN');
    });

    it('should handle Infinity', () => {
      expect(formatNumericValue(Infinity)).toBe('Infinity');
      expect(formatNumericValue(-Infinity)).toBe('-Infinity');
    });
  });

  describe('Very small numbers (scientific notation)', () => {
    it('should use scientific notation for values less than 1e-2', () => {
      const result1 = formatNumericValue(1e-3);
      expect(result1).toMatch(/^1\.000e-3$/i);

      const result2 = formatNumericValue(0.001);
      expect(result2).toMatch(/^1\.000e-3$/i);

      const result3 = formatNumericValue(0.009);
      expect(result3).toMatch(/^9\.000e-3$/i);
    });

    it('should use scientific notation for values just below 1e-2', () => {
      const result = formatNumericValue(0.00999);
      expect(result).toMatch(/^9\.990e-3$/i);
    });

    it('should format the example from requirements correctly', () => {
      // 1.4153928131348452 is in readable range (> 1e-2), so should use standard notation with 4 decimals
      const result = formatNumericValue(1.4153928131348452);
      expect(result).toBe('1.4154');
    });

    it('should handle negative very small numbers', () => {
      const result = formatNumericValue(-1e-3);
      expect(result).toMatch(/^-1\.000e-3$/i);

      const result2 = formatNumericValue(-0.001);
      expect(result2).toMatch(/^-1\.000e-3$/i);
    });
  });

  describe('Human-readable range (standard notation)', () => {
    it('should use standard notation for boundary value 1e-2', () => {
      expect(formatNumericValue(0.01)).toBe('0.01');
    });

    it('should use standard notation for values in readable range', () => {
      expect(formatNumericValue(0.1)).toBe('0.1');
      expect(formatNumericValue(1)).toBe('1');
      expect(formatNumericValue(1.234)).toBe('1.234');
      expect(formatNumericValue(42.5)).toBe('42.5');
    });

    it('should limit to 4 decimal places without rounding integer parts', () => {
      expect(formatNumericValue(123.456)).toBe('123.456');
      expect(formatNumericValue(123.456789)).toBe('123.4568');
      expect(formatNumericValue(1234.567)).toBe('1234.567');
      expect(formatNumericValue(9999.9)).toBe('9999.9');
      expect(formatNumericValue(9999.1234)).toBe('9999.1234');
    });

    it('should use standard notation for boundary value 1e4', () => {
      expect(formatNumericValue(10000)).toBe('10000');
    });

    it('should handle negative numbers in readable range', () => {
      expect(formatNumericValue(-0.1)).toBe('-0.1');
      expect(formatNumericValue(-42.98765)).toBe('-42.9877');
      expect(formatNumericValue(-123.456)).toBe('-123.456');
      expect(formatNumericValue(-9999.9)).toBe('-9999.9');
    });
  });

  describe('Very large numbers (scientific notation)', () => {
    it('should use scientific notation for values greater than 1e4', () => {
      const result1 = formatNumericValue(10001);
      expect(result1).toMatch(/^1\.000e\+4$/i);

      const result2 = formatNumericValue(123456);
      expect(result2).toMatch(/^1\.235e\+5$/i);
    });

    it('should handle negative very large numbers', () => {
      const result = formatNumericValue(-1e5);
      expect(result).toMatch(/^-1\.000e\+5$/i);

      const result2 = formatNumericValue(-123456);
      expect(result2).toMatch(/^-1\.235e\+5$/i);
    });
  });

  describe('Edge cases', () => {
    it('should handle numbers exactly at boundaries', () => {
      // Lower boundary: exactly 1e-2 should use standard notation
      expect(formatNumericValue(0.01)).toBe('0.01');

      // Just below boundary should use scientific notation
      const justBelow = formatNumericValue(0.009999);
      expect(justBelow).toMatch(/^9\.999e-3$/i);

      // Upper boundary: exactly 1e4 should use standard notation
      expect(formatNumericValue(10000)).toBe('10000');

      // Just above boundary should use scientific notation
      const justAbove = formatNumericValue(10001);
      expect(justAbove).toMatch(/^1\.000e\+4$/i);
    });

    it('should limit decimal places for very precise decimals', () => {
      expect(formatNumericValue(1.23456789)).toBe('1.2346');
      expect(formatNumericValue(123.456789)).toBe('123.4568');
      expect(formatNumericValue(0.123456789)).toBe('0.1235');
    });

    it('should handle floating-point precision artifacts', () => {
      const result = formatNumericValue(0.1 + 0.2);
      expect(result).toMatch(/^0\.3/);
    });
  });
});
