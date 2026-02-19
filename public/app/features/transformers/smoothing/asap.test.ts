import { asapSmooth, DataPoint, ASAPOptions } from './asap';

describe('asapSmooth', () => {
  describe('Basic functionality', () => {
    it('should return smoothed data with valid DataPoint objects', () => {
      const data: DataPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
      ];

      const options: ASAPOptions = { resolution: 3 };
      const result = asapSmooth(data, options);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((point) => {
        expect(point).toHaveProperty('x');
        expect(point).toHaveProperty('y');
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
      });
    });

    it('should maintain x-axis ordering', () => {
      const data: DataPoint[] = Array.from({ length: 20 }, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      }));

      const options: ASAPOptions = { resolution: 10 };
      const result = asapSmooth(data, options);

      // check that x values are in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array', () => {
      const data: DataPoint[] = [];
      const options: ASAPOptions = { resolution: 10 };

      const result = asapSmooth(data, options);

      expect(result).toEqual([]);
    });

    it('should handle single data point', () => {
      const data: DataPoint[] = [{ x: 1, y: 42 }];
      const options: ASAPOptions = { resolution: 10 };

      const result = asapSmooth(data, options);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].x).toBe(1);
      expect(result[0].y).toBe(42);
    });

    it('should filter out NaN values', () => {
      const data: DataPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: NaN },
        { x: 2, y: 2 },
        { x: 3, y: NaN },
        { x: 4, y: 4 },
      ];

      const options: ASAPOptions = { resolution: 3 };
      const result = asapSmooth(data, options);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((point) => {
        expect(isNaN(point.x)).toBe(false);
        expect(isNaN(point.y)).toBe(false);
      });
    });

    it('should return empty array when all values are NaN', () => {
      const data: DataPoint[] = [
        { x: 0, y: NaN },
        { x: 1, y: NaN },
        { x: 2, y: NaN },
      ];

      const options: ASAPOptions = { resolution: 3 };
      const result = asapSmooth(data, options);

      expect(result).toEqual([]);
    });

    it('should sort unsorted data', () => {
      const data: DataPoint[] = [
        { x: 3, y: 3 },
        { x: 1, y: 1 },
        { x: 4, y: 4 },
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ];

      const options: ASAPOptions = { resolution: 3 };
      const result = asapSmooth(data, options);

      expect(result.length).toBeGreaterThan(0);

      // result should be sorted by x
      for (let i = 1; i < result.length; i++) {
        expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x);
      }
    });

    it('should handle negative values', () => {
      const data: DataPoint[] = Array.from({ length: 10 }, (_, i) => ({
        x: i,
        y: -i * 2,
      }));

      const options: ASAPOptions = { resolution: 5 };
      const result = asapSmooth(data, options);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((point) => {
        expect(isFinite(point.y)).toBe(true);
      });
    });
  });
});
