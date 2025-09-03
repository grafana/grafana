import { FieldType } from '../types/dataFrame';

import { createDataFrame, toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField, addRow, alignTimeRangeCompareData } from './utils';

describe('anySeriesWithTimeField', () => {
  describe('single frame', () => {
    test('without time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA])).toBeFalsy();
    });

    test('with time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA])).toBeTruthy();
    });
  });

  describe('multiple frames', () => {
    test('without time field', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      });
      expect(anySeriesWithTimeField([frameA, frameB])).toBeFalsy();
    });

    test('with time field in any frame', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
      });
      const frameC = toDataFrame({
        fields: [{ name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] }],
      });

      expect(anySeriesWithTimeField([frameA, frameB, frameC])).toBeTruthy();
    });

    test('with time field in a all frames', () => {
      const frameA = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      const frameB = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      });
      expect(anySeriesWithTimeField([frameA, frameB])).toBeTruthy();
    });
  });
});

describe('addRow', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string },
      { name: 'date', type: FieldType.time },
      { name: 'number', type: FieldType.number },
    ],
  });
  const date = Date.now();

  it('adds row to data frame as object', () => {
    addRow(frame, { name: 'A', date, number: 1 });
    expect(frame.fields[0].values[0]).toBe('A');
    expect(frame.fields[1].values[0]).toBe(date);
    expect(frame.fields[2].values[0]).toBe(1);
    expect(frame.length).toBe(1);
  });

  it('adds row to data frame as array', () => {
    addRow(frame, ['B', date, 42]);
    expect(frame.fields[0].values[1]).toBe('B');
    expect(frame.fields[1].values[1]).toBe(date);
    expect(frame.fields[2].values[1]).toBe(42);
    expect(frame.length).toBe(2);
  });
});

describe('alignTimeRangeCompareData', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 86400000ms
  const ONE_WEEK_MS = 7 * ONE_DAY_MS; // 604800000ms

  it('should align time field values with positive diff (1 day)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'value', type: FieldType.number, values: [10, 20, 30] },
      ],
    });

    alignTimeRangeCompareData(frame, ONE_DAY_MS);

    expect(frame.fields[0].values).toEqual([ONE_DAY_MS + 1000, ONE_DAY_MS + 2000, ONE_DAY_MS + 3000]);
    expect(frame.fields[1].values).toEqual([10, 20, 30]); // non-time fields unchanged
  });

  it('should align time field values with negative diff (1 week)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'value', type: FieldType.number, values: [10, 20, 30] },
      ],
    });

    alignTimeRangeCompareData(frame, -ONE_WEEK_MS);

    // When diff is negative, function does v - diff, so v - (-ONE_WEEK_MS) = v + ONE_WEEK_MS
    expect(frame.fields[0].values).toEqual([ONE_WEEK_MS + 1000, ONE_WEEK_MS + 2000, ONE_WEEK_MS + 3000]);
  });

  it('should apply default gray color and timeCompare config', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });

    alignTimeRangeCompareData(frame, ONE_DAY_MS);

    frame.fields.forEach((field) => {
      expect(field.config.color?.fixedColor).toBe('gray');
      expect(field.config.custom?.timeCompare).toEqual({
        diffMs: ONE_DAY_MS,
        isTimeShiftQuery: true,
      });
    });
  });

  it('should apply custom color when provided', () => {
    const frame = toDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [10, 20] }],
    });

    alignTimeRangeCompareData(frame, ONE_DAY_MS, 'red');

    expect(frame.fields[0].config.color?.fixedColor).toBe('red');
  });

  it('should preserve existing config when merging', () => {
    const frame = toDataFrame({
      fields: [
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20],
          config: {
            displayName: 'My Display Name',
            custom: { existingProperty: 'existingValue' },
          },
        },
      ],
    });

    alignTimeRangeCompareData(frame, ONE_WEEK_MS);

    expect(frame.fields[0].config.displayName).toBe('My Display Name');
    expect(frame.fields[0].config.custom?.existingProperty).toBe('existingValue');
    expect(frame.fields[0].config.custom?.timeCompare?.diffMs).toBe(ONE_WEEK_MS);
  });
});
