import { createDataFrame, FieldType, toDataFrame } from '@grafana/data/dataframe';

import { prepSeries } from './utils';

describe('prepSeries', () => {
  describe('multiple frames', () => {
    it('returns a warning when more than one frame is provided', () => {
      const frame1 = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [4, 5, 6] },
          { name: 'y', type: FieldType.number, values: [40, 50, 60] },
        ],
      });

      const result = prepSeries([frame1, frame2]);

      expect(result.warning).toBe('Only one frame is supported, consider adding a join transformation');
    });

    it('returns the original frames when there are multiple frames', () => {
      const frame1 = toDataFrame({
        fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
      });
      const frame2 = toDataFrame({
        fields: [{ name: 'x', type: FieldType.number, values: [4, 5, 6] }],
      });

      const result = prepSeries([frame1, frame2]);

      expect(result.frames).toEqual([frame1, frame2]);
    });
  });

  describe('xField resolution', () => {
    it('returns a warning when the named xField is not found', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const result = prepSeries([frame], 'nonexistent');

      expect(result.warning).toBe('Unable to find field: nonexistent');
    });

    it('returns the original frames when the named xField is not found', () => {
      const frame = toDataFrame({
        fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
      });

      const result = prepSeries([frame], 'nonexistent');

      expect(result.frames).toEqual([frame]);
    });

    it('returns a warning when no numeric fields are present and xField is not specified', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'label', type: FieldType.string, values: ['a', 'b', 'c'] },
        ],
      });

      const result = prepSeries([frame]);

      expect(result.warning).toBe('No numeric fields found for X axis');
    });

    it('returns the original frames when no numeric fields are present', () => {
      const frame = toDataFrame({
        fields: [{ name: 'label', type: FieldType.string, values: ['a', 'b', 'c'] }],
      });

      const result = prepSeries([frame]);

      expect(result.frames).toEqual([frame]);
    });

    it('returns a warning when no frames are provided and xField is not specified', () => {
      const result = prepSeries([]);

      expect(result.warning).toBe('No numeric fields found for X axis');
    });
  });

  describe('ascending order validation', () => {
    it('returns a warning when x values are not ascending', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [3, 2, 1] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const result = prepSeries([frame]);

      expect(result.warning).toBe('Values must be in ascending order');
    });

    it('returns the original frames when x values are not ascending', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [3, 2, 1] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const result = prepSeries([frame]);

      expect(result.frames).toEqual([frame]);
    });

    it('returns a warning when explicitly named xField values are not ascending', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
          { name: 'x', type: FieldType.number, values: [30, 20, 10] },
        ],
      });

      const result = prepSeries([frame], 'x');

      expect(result.warning).toBe('Values must be in ascending order');
    });

    it('returns a warning when x values contain consecutive duplicates', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 1, 2] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const result = prepSeries([frame]);

      expect(result.warning).toBe('Values must be in ascending order');
    });
  });

  describe('happy path', () => {
    it('returns no warning when auto-detecting the first numeric field as x', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      });

      const result = prepSeries([frame]);

      expect(result.warning).toBeUndefined();
      expect(result.frames).not.toBeNull();
    });

    it('returns no warning when an explicit ascending xField is provided', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
          { name: 'x', type: FieldType.number, values: [1, 2, 3] },
        ],
      });

      const result = prepSeries([frame], 'x');

      expect(result.warning).toBeUndefined();
      expect(result.frames).not.toBeNull();
    });
  });
});
