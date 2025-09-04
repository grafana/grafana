import { createTheme } from '../themes/createTheme';
import { FieldType } from '../types/dataFrame';

import { createDataFrame, toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField, addRow, alignTimeRangeCompareData, shouldAlignTimeCompare } from './utils';

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

    alignTimeRangeCompareData(frame, ONE_DAY_MS, createTheme());

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

    alignTimeRangeCompareData(frame, -ONE_WEEK_MS, createTheme());

    // When diff is negative, function does v - diff, so v - (-ONE_WEEK_MS) = v + ONE_WEEK_MS
    expect(frame.fields[0].values).toEqual([ONE_WEEK_MS + 1000, ONE_WEEK_MS + 2000, ONE_WEEK_MS + 3000]);
  });

  it('should apply timeCompare config', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    });

    alignTimeRangeCompareData(frame, ONE_DAY_MS, createTheme());

    frame.fields.forEach((field) => {
      expect(field.config.custom?.timeCompare).toEqual({
        diffMs: ONE_DAY_MS,
        isTimeShiftQuery: true,
      });
    });
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

    alignTimeRangeCompareData(frame, ONE_WEEK_MS, createTheme());

    expect(frame.fields[0].config.displayName).toBe('My Display Name');
    expect(frame.fields[0].config.custom?.existingProperty).toBe('existingValue');
    expect(frame.fields[0].config.custom?.timeCompare?.diffMs).toBe(ONE_WEEK_MS);
  });
});

describe('shouldAlignTimeCompare', () => {
  const TIME_VALUES_A = [1000, 2000, 3000];
  const TIME_VALUES_B = [5000, 6000, 7000];
  const ORIGINAL_VALUES = [10, 20, 30];
  const COMPARE_VALUES = [15, 25, 35];

  it('should return true when compare and original frames have matching time ranges', () => {
    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: COMPARE_VALUES },
      ],
      meta: {
        timeCompare: {
          isTimeShiftQuery: true,
          diffMs: 86400000,
        },
      },
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(true);
  });

  it('should return false when compare and original frames have different time ranges', () => {
    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_B },
        { name: 'value', type: FieldType.number, values: COMPARE_VALUES },
      ],
      meta: {
        timeCompare: {
          isTimeShiftQuery: true,
          diffMs: 86400000,
        },
      },
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should return false when compare frame refId does not end with -compare', () => {
    const compareFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const allFrames = [compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should return false when original frame is not found', () => {
    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const allFrames = [compareFrame]; // No original frame with refId 'A'
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should return false when compare frame has no time field', () => {
    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [{ name: 'value', type: FieldType.number, values: COMPARE_VALUES }],
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should return false when original frame has no time field', () => {
    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [{ name: 'value', type: FieldType.number, values: ORIGINAL_VALUES }],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_VALUES_A },
        { name: 'value', type: FieldType.number, values: COMPARE_VALUES },
      ],
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should return false when time fields have empty values', () => {
    const EMPTY_VALUES: number[] = [];

    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: EMPTY_VALUES },
        { name: 'value', type: FieldType.number, values: EMPTY_VALUES },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: EMPTY_VALUES },
        { name: 'value', type: FieldType.number, values: EMPTY_VALUES },
      ],
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });

  it('should handle null values and return true when first non-null values match', () => {
    const TIME_WITH_NULLS = [null, ...TIME_VALUES_A];
    const ORIGINAL_WITH_NULLS = [null, ...ORIGINAL_VALUES];
    const COMPARE_WITH_NULLS = [null, ...COMPARE_VALUES];

    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_WITH_NULLS },
        { name: 'value', type: FieldType.number, values: ORIGINAL_WITH_NULLS },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: TIME_WITH_NULLS },
        { name: 'value', type: FieldType.number, values: COMPARE_WITH_NULLS },
      ],
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(true);
  });

  it('should return false when all time values are null', () => {
    const ALL_NULL_TIMES = [null, null, null];

    const originalFrame = toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: ALL_NULL_TIMES },
        { name: 'value', type: FieldType.number, values: ORIGINAL_VALUES },
      ],
    });

    const compareFrame = toDataFrame({
      refId: 'A-compare',
      fields: [
        { name: 'time', type: FieldType.time, values: ALL_NULL_TIMES },
        { name: 'value', type: FieldType.number, values: COMPARE_VALUES },
      ],
    });

    const allFrames = [originalFrame, compareFrame];
    expect(shouldAlignTimeCompare(compareFrame, allFrames)).toBe(false);
  });
});
