import { createDataFrame, FieldType, type DataFrameWithValue } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { getColumnTypes, getDisplayName } from './fields';
import { compileFrameToRecords } from './rows';
import { applySort, getComparator } from './sort';

describe('getComparator', () => {
  it('should compare numbers correctly', () => {
    const comparator = getComparator(FieldType.number);
    expect(comparator(1, 2)).toBeLessThan(0);
    expect(comparator(2, 1)).toBeGreaterThan(0);
    expect(comparator(1, 1)).toBe(0);
  });

  it('should handle undefined values', () => {
    const comparator = getComparator(FieldType.number);
    expect(comparator(undefined, 1)).toBeLessThan(0);
    expect(comparator(1, undefined)).toBeGreaterThan(0);
    expect(comparator(undefined, undefined)).toBe(0);
  });

  it('should compare strings case-insensitively', () => {
    const comparator = getComparator(FieldType.string);
    expect(comparator('a', 'B')).toBeLessThan(0);
    expect(comparator('B', 'a')).toBeGreaterThan(0);
    expect(comparator('a', 'a')).toBe(0);
  });

  it('should handle time values', () => {
    const comparator = getComparator(FieldType.time);
    const t1 = 1672531200000; // 2023-01-01
    const t2 = 1672617600000; // 2023-01-02

    expect(comparator(t1, t2)).toBeLessThan(0);
    expect(comparator(t2, t1)).toBeGreaterThan(0);
    expect(comparator(t1, t1)).toBe(0);
  });

  it('should handle boolean values', () => {
    const comparator = getComparator(FieldType.boolean);
    expect(comparator(false, true)).toBeLessThan(0);
    expect(comparator(true, false)).toBeGreaterThan(0);
    expect(comparator(true, true)).toBe(0);
  });

  it('should compare frame values', () => {
    const comparator = getComparator(FieldType.frame);

    // simulate using `first`.
    const frame1: DataFrameWithValue = {
      value: 1,
      ...createDataFrame({ fields: [{ name: 'a', values: [1, 2, 3, 4] }] }),
    };
    const frame2: DataFrameWithValue = {
      value: 4,
      ...createDataFrame({ fields: [{ name: 'a', values: [4, 3, 2, 1] }] }),
    };
    const frame3: DataFrameWithValue = {
      value: 4,
      ...createDataFrame({ fields: [{ name: 'a', values: [4, 5, 6, 7] }] }),
    };

    expect(comparator(frame1, frame2)).toBeLessThan(0);
    expect(comparator(frame2, frame1)).toBeGreaterThan(0);
    expect(comparator(frame2, frame2)).toBe(0);
    expect(comparator(frame2, frame3)).toBe(0); // equivalent start values
  });
});

describe('applySort', () => {
  it('returns the same records if no sort columns are provided', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2, 1] },
        { name: 'value', values: [30, 20, 10] },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const sorted = applySort(frameToRecords(frame), frame.fields, [], getColumnTypes(frame.fields), false);
    expect(sorted).toMatchObject([
      { time: 1, value: 30 },
      { time: 2, value: 20 },
      { time: 1, value: 10 },
    ]);
  });

  it('sorts the records by the sort columns', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 1, 2, 2] },
        { name: 'value', values: [10, 20, 30, 40] },
        { name: 'value2', values: [40, 20, 40, 30] },
      ],
    });
    const sortColumns: SortColumn[] = [
      { columnKey: 'time', direction: 'ASC' },
      { columnKey: 'value2', direction: 'DESC' },
    ];
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const sorted = applySort(frameToRecords(frame), frame.fields, sortColumns, getColumnTypes(frame.fields), false);
    expect(sorted).toMatchObject([
      { time: 1, value: 10, value2: 40 },
      { time: 1, value: 20, value2: 20 },
      { time: 2, value: 30, value2: 40 },
      { time: 2, value: 40, value2: 30 },
    ]);
  });

  it('does not mutate the original records', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 3, 2] },
        { name: 'value', values: [10, 20, 30] },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const rows = frameToRecords(frame);
    const sortColumns: SortColumn[] = [{ columnKey: 'time', direction: 'ASC' }];
    const sorted = applySort(rows, frame.fields, sortColumns, getColumnTypes(frame.fields), false);
    expect(rows).toMatchObject([
      { time: 1, value: 10 },
      { time: 3, value: 20 },
      { time: 2, value: 30 },
    ]);
    expect(sorted).toMatchObject([
      { time: 1, value: 10 },
      { time: 2, value: 30 },
      { time: 3, value: 20 },
    ]);
  });

  it('handles nested frames', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 1, 2] },
        { name: 'value', values: [30, 20, 10] },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: [
            [createDataFrame({ fields: [{ name: 'value2', values: [10, 30] }] })],
            [createDataFrame({ fields: [{ name: 'value2', values: [20, 40] }] })],
            [createDataFrame({ fields: [{ name: 'value2', values: [40, 30] }] })],
          ],
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName), 'nested');
    const sorted = applySort(
      frameToRecords(frame),
      frame.fields,
      [
        { columnKey: 'value2', direction: 'DESC' },
        { columnKey: 'value', direction: 'ASC' },
      ],
      getColumnTypes(frame.fields),
      true
    );

    // the sort method won't sort the values in the nested data frame's "fields" here. useNestedRows calls applySort on the nested rows.
    expect(sorted).toMatchObject([
      { __depth: 0, __index: 2, time: 2, value: 10 },
      { __depth: 1, __index: 2 },
      { __depth: 0, __index: 1, time: 1, value: 20 },
      { __depth: 1, __index: 1 },
      { __depth: 0, __index: 0, time: 1, value: 30 },
      { __depth: 1, __index: 0 },
    ]);
  });

  it('sorts by nanos', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 1, 2], nanos: [100, 99, 0] },
        { name: 'value', values: [10, 20, 30] },
      ],
    });

    const sortColumns: SortColumn[] = [{ columnKey: 'time', direction: 'ASC' }];

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const sorted = applySort(frameToRecords(frame), frame.fields, sortColumns, getColumnTypes(frame.fields), false);

    expect(sorted).toMatchObject([
      { time: 1, value: 20 },
      { time: 1, value: 10 },
      { time: 2, value: 30 },
    ]);
  });
});
