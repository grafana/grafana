import {
  DataFrame,
  DataTransformContext,
  FieldType,
  toDataFrame,
  TransformationApplicabilityLevels,
} from '@grafana/data';

import { calculateMaxSourcePoints, getSmoothingTransformer, SmoothingTransformerOptions } from './smoothing';

describe('Smoothing transformer', () => {
  const smoothingTransformer = getSmoothingTransformer();
  const ctx: DataTransformContext = {
    interpolate: (v: string) => v,
  };

  describe('isApplicable', () => {
    it('should return Applicable for time series frames', () => {
      const frames = [
        toDataFrame({
          name: 'time series',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      expect(smoothingTransformer.isApplicable!(frames)).toBe(TransformationApplicabilityLevels.Applicable);
    });

    it('should return NotApplicable for frames without time field', () => {
      const frames = [
        toDataFrame({
          name: 'no time field',
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      expect(smoothingTransformer.isApplicable!(frames)).toBe(TransformationApplicabilityLevels.NotApplicable);
    });

    it('should return Applicable if at least one frame is a time series', () => {
      const frames = [
        toDataFrame({
          name: 'not time series',
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'label', type: FieldType.string, values: ['X', 'Y', 'Z'] },
          ],
        }),
        toDataFrame({
          name: 'time series',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      expect(smoothingTransformer.isApplicable!(frames)).toBe(TransformationApplicabilityLevels.Applicable);
    });

    it('should return NotApplicable for empty data', () => {
      const frames: DataFrame[] = [];

      expect(smoothingTransformer.isApplicable!(frames)).toBe(TransformationApplicabilityLevels.NotApplicable);
    });
  });

  describe('Basic functionality', () => {
    it('should smooth time series data with default settings', () => {
      const source = [
        toDataFrame({
          name: 'test data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15, 25, 18] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test data (smoothed)');
      expect(result[0].fields).toHaveLength(2);
      expect(result[0].fields[0].name).toBe('time');
      expect(result[0].fields[1].name).toBe('value (smoothed)');

      // should preserve original time points
      expect(result[0].fields[0].values).toEqual([1000, 2000, 3000, 4000, 5000]);
      // should have corresponding smoothed values
      expect(result[0].fields[1].values.length).toBe(5);
    });

    it('should handle multiple numeric fields', () => {
      const source = [
        toDataFrame({
          name: 'multi field data',
          refId: 'B',
          fields: [
            { name: 'timestamp', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'cpu', type: FieldType.number, values: [50, 75, 60, 80] },
            { name: 'memory', type: FieldType.number, values: [40, 55, 45, 65] },
            { name: 'label', type: FieldType.string, values: ['a', 'b', 'c', 'd'] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 3 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toHaveLength(1);
      expect(result[0].fields).toHaveLength(4);
      expect(result[0].fields[0].name).toBe('timestamp');
      expect(result[0].fields[1].name).toBe('cpu (smoothed)');
      expect(result[0].fields[2].name).toBe('memory (smoothed)');
      expect(result[0].fields[3].name).toBe('label');

      // all numeric fields should be smoothed and preserve original time points
      expect(result[0].fields[0].values.length).toBe(4);
      expect(result[0].fields[1].values.length).toBe(4);
      expect(result[0].fields[2].values.length).toBe(4);
    });

    it('should preserve non-numeric and non-time fields', () => {
      const source = [
        toDataFrame({
          name: 'mixed data',
          refId: 'C',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'active', type: FieldType.boolean, values: [true, false, true] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 2 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result[0].fields[2].name).toBe('category');
      expect(result[0].fields[2].type).toBe(FieldType.string);
      expect(result[0].fields[3].name).toBe('active');
      expect(result[0].fields[3].type).toBe(FieldType.boolean);
    });
  });

  describe('Configuration options', () => {
    it('should use default resolution when not specified', () => {
      const source = [
        toDataFrame({
          name: 'default test',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: Array.from({ length: 200 }, (_, i) => i * 1000) },
            { name: 'value', type: FieldType.number, values: Array.from({ length: 200 }, () => Math.random() * 100) },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should preserve all original time points
      expect(result[0].fields[0].values.length).toBe(200);
      expect(result[0].fields[1].values.length).toBe(200);
    });

    it('should respect custom resolution settings', () => {
      const source = [
        toDataFrame({
          name: 'resolution test',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: Array.from({ length: 100 }, (_, i) => i * 1000) },
            { name: 'value', type: FieldType.number, values: Array.from({ length: 100 }, () => Math.random() * 100) },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 25 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should preserve all original time points regardless of resolution
      expect(result[0].fields[0].values.length).toBe(100);
      expect(result[0].fields[1].values.length).toBe(100);
    });

    it('should clamp resolution to minimum value', () => {
      const source = [
        toDataFrame({
          name: 'small resolution test',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15, 25, 18] },
          ],
        }),
      ];

      // request resolution below minimum - should be clamped to 10
      const config: SmoothingTransformerOptions = { resolution: 2 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should preserve all original time points and clamp resolution to minimum
      expect(result[0].fields[0].values.length).toBe(5);
      expect(result[0].fields[1].values.length).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data frames', () => {
      const source: DataFrame[] = [];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toEqual([]);
    });

    it('should handle frames without time fields', () => {
      const source = [
        toDataFrame({
          name: 'no time field',
          refId: 'A',
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should return original frame unchanged
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(source[0]);
    });

    it('should handle frames without numeric fields', () => {
      const source = [
        toDataFrame({
          name: 'no numeric fields',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should return original frame unchanged
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(source[0]);
    });

    it('should filter out NaN values when smoothing', () => {
      const source = [
        toDataFrame({
          name: 'data with NaN',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'value', type: FieldType.number, values: [10, NaN, 15, 25, NaN] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 3 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should preserve all time points
      expect(result[0].fields[0].values.length).toBe(5);
      expect(result[0].fields[1].values.length).toBe(5);

      // all values should be interpolated from smoothed curve (no nulls)
      const values = result[0].fields[1].values;
      values.forEach((value) => {
        expect(value).not.toBeNull();
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });

    it('should handle data with all NaN values', () => {
      const source = [
        toDataFrame({
          name: 'all NaN data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [NaN, NaN, NaN] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // When all values are NaN, frame should be returned unchanged
      expect(result[0].fields[1].name).toBe('value'); // No "(smoothed)" suffix
      expect(result[0].fields[1].values).toEqual([NaN, NaN, NaN]);
      expect(result[0].name).toBe('all NaN data'); // Original name preserved
    });

    it('should handle data with null values', () => {
      const source = [
        toDataFrame({
          name: 'data with nulls',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'value', type: FieldType.number, values: [10, null, 15, 25] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 3 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should preserve all time points
      expect(result[0].fields[0].values.length).toBe(4);
      expect(result[0].fields[1].values.length).toBe(4);

      // all values should be interpolated (no nulls in output)
      const values = result[0].fields[1].values;
      values.forEach((value) => {
        expect(value).not.toBeNull();
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });

    it('should handle single data point', () => {
      const source = [
        toDataFrame({
          name: 'single point',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000] },
            { name: 'value', type: FieldType.number, values: [42] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result[0].fields[0].values).toHaveLength(1);
      expect(result[0].fields[1].values).toHaveLength(1);
      expect(result[0].fields[1].values[0]).toBe(42);
    });

    it('should handle empty numeric field values', () => {
      const source = [
        toDataFrame({
          name: 'empty values',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      // should return original frame since no numeric data to smooth
      expect(result[0]).toEqual(source[0]);
    });
  });

  describe('Data integrity', () => {
    it('should maintain time ordering in smoothed data', () => {
      const source = [
        toDataFrame({
          name: 'ordered data',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15, 25, 18] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 4 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      const timeValues = result[0].fields[0].values as number[];

      // check that time values are in ascending order
      for (let i = 1; i < timeValues.length; i++) {
        expect(timeValues[i]).toBeGreaterThanOrEqual(timeValues[i - 1]);
      }
    });

    it('should preserve original frame metadata', () => {
      const source = [
        toDataFrame({
          name: 'original name',
          refId: 'TEST',
          meta: { custom: { test: 'value' } },
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result[0].refId).toBe('TEST');
      expect(result[0].meta).toEqual(source[0].meta);
      expect(result[0].name).toBe('original name (smoothed)');
    });

    it('should handle frames with no name', () => {
      const source = [
        toDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result[0].name).toBe('Data (smoothed)');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle sparse data with irregular intervals', () => {
      // based on real user data with ~10 points over 30 minutes
      const source = [
        toDataFrame({
          name: 'temperature',
          refId: 'A',
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: [
                1733999700000, 1733999790000, 1734000000000, 1734000210000, 1734000420000, 1734000630000, 1734000840000,
                1734001050000, 1734001260000, 1734001470000,
              ],
            },
            {
              name: 'value',
              type: FieldType.number,
              values: [31.1, 31.1, 30.2, 30.8, 29.8, 30.0, 29.3, 28.6, 29.6, 30.5],
            },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 20 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toHaveLength(1);
      expect(result[0].fields[0].values.length).toBe(10);
      expect(result[0].fields[1].values.length).toBe(10);

      // all values should be non-null numbers
      const values = result[0].fields[1].values;
      values.forEach((value) => {
        expect(value).not.toBeNull();
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });
  });

  describe('Multiple frames', () => {
    it('should process multiple frames independently', () => {
      const source = [
        toDataFrame({
          name: 'frame1',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
        toDataFrame({
          name: 'frame2',
          refId: 'B',
          fields: [
            { name: 'timestamp', type: FieldType.time, values: [4000, 5000, 6000] },
            { name: 'metric', type: FieldType.number, values: [30, 40, 35] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = { resolution: 2 };

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('frame1 (smoothed)');
      expect(result[1].name).toBe('frame2 (smoothed)');
      expect(result[0].refId).toBe('A');
      expect(result[1].refId).toBe('B');
    });

    it('should handle mixed frame types', () => {
      const source = [
        toDataFrame({
          name: 'valid frame',
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
        toDataFrame({
          name: 'invalid frame',
          refId: 'B',
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'label', type: FieldType.string, values: ['X', 'Y', 'Z'] },
          ],
        }),
      ];

      const config: SmoothingTransformerOptions = {};

      const result = smoothingTransformer.transformer(config, ctx)(source);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('valid frame (smoothed)');
      expect(result[1]).toEqual(source[1]);
    });
  });

  describe('calculateMaxSourcePoints', () => {
    it('should return 0 for empty frames', () => {
      expect(calculateMaxSourcePoints([])).toBe(0);
    });

    it('should return 0 for frames without time fields', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(0);
    });

    it('should return 0 for frames without numeric fields', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'category', type: FieldType.string, values: ['A', 'B', 'C'] },
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(0);
    });

    it('should count valid data points, filtering out null and NaN', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'value', type: FieldType.number, values: [10, null, 15, NaN, 18] },
          ],
        }),
      ];

      // Only 3 valid points: 10, 15, 18
      expect(calculateMaxSourcePoints(frames)).toBe(3);
    });

    it('should return maximum across multiple numeric fields', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'cpu', type: FieldType.number, values: [10, null, 15] }, // 2 valid points
            { name: 'memory', type: FieldType.number, values: [20, 25, 30, 35] }, // 4 valid points
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(4);
    });

    it('should return maximum across multiple frames', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 15] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000, 5000] },
            { name: 'metric', type: FieldType.number, values: [30, 40, 35, 45, 50] },
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(5);
    });

    it('should handle frames with all valid points', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30, 40] },
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(4);
    });

    it('should handle frames with all null values', () => {
      const frames = [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
            { name: 'value', type: FieldType.number, values: [null, null, null] },
          ],
        }),
      ];

      expect(calculateMaxSourcePoints(frames)).toBe(0);
    });
  });
});
