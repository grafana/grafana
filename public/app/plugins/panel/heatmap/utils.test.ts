import { boundedMinMax, valuesToFills } from './utils';

describe('boundedMinMax', () => {
  describe('when min and max are not provided', () => {
    it('calculates min and max from values', () => {
      const values = [10, 20, 5, 30, 15];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(5);
      expect(max).toBe(30);
    });

    it('handles single value', () => {
      const values = [42];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(42);
      expect(max).toBe(42);
    });

    it('handles negative values', () => {
      const values = [-10, -20, -5, -30];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(-30);
      expect(max).toBe(-5);
    });

    it('handles mixed positive and negative values', () => {
      const values = [-10, 20, -5, 30];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(-10);
      expect(max).toBe(30);
    });

    it('returns Infinity/-Infinity for empty array', () => {
      const values: number[] = [];
      const [min, max] = boundedMinMax(values);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('when min is provided', () => {
    it('uses provided min value', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 0);
      expect(min).toBe(0);
      expect(max).toBe(30);
    });

    it('uses provided min even if higher than data min', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 15);
      expect(min).toBe(15);
      expect(max).toBe(30);
    });
  });

  describe('when max is provided', () => {
    it('uses provided max value', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, undefined, 50);
      expect(min).toBe(5);
      expect(max).toBe(50);
    });

    it('uses provided max even if lower than data max', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, undefined, 25);
      expect(min).toBe(5);
      expect(max).toBe(25);
    });
  });

  describe('when both min and max are provided', () => {
    it('uses both provided values', () => {
      const values = [10, 20, 5, 30];
      const [min, max] = boundedMinMax(values, 0, 50);
      expect(min).toBe(0);
      expect(max).toBe(50);
    });
  });

  describe('with hideLE filter', () => {
    it('excludes values less than or equal to hideLE', () => {
      const values = [5, 10, 15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, 10);
      expect(min).toBe(15);
      expect(max).toBe(25);
    });

    it('excludes all values when hideLE is higher than all values', () => {
      const values = [5, 10, 15];
      const [min, max] = boundedMinMax(values, undefined, undefined, 20);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('with hideGE filter', () => {
    it('excludes values greater than or equal to hideGE', () => {
      const values = [5, 10, 15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, -Infinity, 20);
      expect(min).toBe(5);
      expect(max).toBe(15);
    });

    it('excludes all values when hideGE is lower than all values', () => {
      const values = [15, 20, 25];
      const [min, max] = boundedMinMax(values, undefined, undefined, -Infinity, 10);
      expect(min).toBe(Infinity);
      expect(max).toBe(-Infinity);
    });
  });

  describe('with both hideLE and hideGE filters', () => {
    it('excludes values outside the range', () => {
      const values = [5, 10, 15, 20, 25, 30];
      const [min, max] = boundedMinMax(values, undefined, undefined, 10, 25);
      expect(min).toBe(15);
      expect(max).toBe(20);
    });

    it('works with provided min/max bounds', () => {
      const values = [5, 10, 15, 20, 25, 30];
      const [min, max] = boundedMinMax(values, 0, 50, 10, 25);
      expect(min).toBe(0);
      expect(max).toBe(50);
    });
  });
});

describe('valuesToFills', () => {
  // Fake color palette for testing index mapping
  const palette5 = ['c0', 'c1', 'c2', 'c3', 'c4'];

  describe('basic mapping', () => {
    it('maps values to palette indices', () => {
      const values = [0, 25, 50, 75, 100];
      const fills = valuesToFills(values, palette5, 0, 100);

      expect(fills).toEqual([0, 1, 2, 3, 4]);
    });

    it('maps min value to first palette index', () => {
      const values = [10];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(0);
    });

    it('maps max value to last palette index', () => {
      const values = [20];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(4);
    });

    it('maps mid-range values proportionally', () => {
      const values = [15];
      const fills = valuesToFills(values, palette5, 10, 20);

      // 15 is middle of 10-20, should map to index 2 (middle color)
      expect(fills[0]).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('clamps values below min to first index', () => {
      const values = [5, 8, 10];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(0); // 5 < 10
      expect(fills[1]).toBe(0); // 8 < 10
    });

    it('clamps values above max to last index', () => {
      const values = [20, 25, 30];
      const fills = valuesToFills(values, palette5, 10, 20);

      expect(fills[0]).toBe(4); // 20 = max
      expect(fills[1]).toBe(4); // 25 > max
      expect(fills[2]).toBe(4); // 30 > max
    });

    it('handles zero range (min equals max)', () => {
      const values = [10, 10, 10];
      const fills = valuesToFills(values, palette5, 10, 10);

      // When range is 0, defaults to 1, so all values map to 0
      expect(fills).toEqual([0, 0, 0]);
    });

    it('handles single color palette', () => {
      const values = [0, 50, 100];
      const palette = ['c0'];
      const fills = valuesToFills(values, palette, 0, 100);

      expect(fills).toEqual([0, 0, 0]);
    });

    it('handles large palette', () => {
      const values = [50];
      const palette = Array.from({ length: 256 }, (_, i) => `c${i}`);
      const fills = valuesToFills(values, palette, 0, 100);

      // 50 is 50% of 0-100, should map to 128 (middle of 256)
      expect(fills[0]).toBe(128);
    });
  });

  describe('negative values', () => {
    it('handles negative min and max', () => {
      const values = [-10, -5, 0];
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills(values, palette, -10, 0);

      expect(fills[0]).toBe(0); // -10 is min
      expect(fills[1]).toBe(1); // -5 is middle
      expect(fills[2]).toBe(2); // 0 is max
    });

    it('handles range crossing zero', () => {
      const values = [-10, 0, 10];
      const palette = ['c0', 'c1', 'c2'];
      const fills = valuesToFills(values, palette, -10, 10);

      expect(fills[0]).toBe(0); // -10 is min
      expect(fills[1]).toBe(1); // 0 is middle
      expect(fills[2]).toBe(2); // 10 is max
    });
  });

  describe('preserves array length', () => {
    it('returns array with same length as input', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const palette = ['c0', 'c1'];
      const fills = valuesToFills(values, palette, 1, 10);

      expect(fills.length).toBe(values.length);
    });

    it('handles empty array', () => {
      const values: number[] = [];
      const fills = valuesToFills(values, palette5, 0, 100);

      expect(fills).toEqual([]);
    });
  });
});
