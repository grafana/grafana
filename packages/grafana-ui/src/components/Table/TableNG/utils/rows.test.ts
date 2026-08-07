import { createDataFrame, FieldType, type DataFrame, type DataFrameWithValue } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { type TableRow } from '../types';

import { getColumnTypes, getDisplayName } from './fields';
import { applyFilter, applySort, compileFrameToRecords, getComparator } from './rows';

describe('frame to records conversion', () => {
  it('should convert DataFrame to TableRows', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);
    expect(records).toHaveLength(2);
    // Columns are exposed via prototype getters, not own properties, so assert with
    // toMatchObject (walks the prototype chain) rather than toEqual (own-props only).
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 10 });
  });

  it('should handle nested frames', () => {
    const childFrame1 = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });
    const childFrame2 = createDataFrame({
      fields: [
        { name: 'time', values: [3, 4] },
        { name: 'value', values: [30, 40] },
      ],
    });
    const parentFrame = createDataFrame({
      fields: [
        { name: 'id', values: [100, 200] },
        { name: 'nested', values: [[childFrame1], [childFrame2]], type: FieldType.nestedFrames },
      ],
    });

    const frameToRecords = compileFrameToRecords(parentFrame.fields.map(getDisplayName), 'nested');
    const records = frameToRecords(parentFrame);
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, id: 100 });
    expect(records[1]).toEqual({ __depth: 1, __index: 0 });
    expect(records[2]).toMatchObject({ __depth: 0, __index: 1, id: 200 });
    expect(records[3]).toEqual({ __depth: 1, __index: 1 });
  });

  it('should render a nested row correctly', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame, 3);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, __parentIndex: 3, time: 1, value: 10 });
    expect(records[1]).toMatchObject({ __depth: 0, __index: 1, __parentIndex: 3, time: 2, value: 20 });
  });

  it('should infer length from field values when frame.length is not set', () => {
    const frame: DataFrame = {
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20, 30], config: {} },
      ],
    } as unknown as DataFrame;

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 10 });
    expect(records[1]).toMatchObject({ __depth: 0, __index: 1, time: 2, value: 20 });
    expect(records[2]).toMatchObject({ __depth: 0, __index: 2, time: 3, value: 30 });
  });

  it('should produce no rows when frame.length is not set and the nested frame has no fields', () => {
    const frame: DataFrame = {
      fields: [],
    } as unknown as DataFrame;

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame, 3);

    expect(records).toHaveLength(0);
  });
});

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

describe('applyFilter', () => {
  it('returns the same records if no filter columns are provided', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 1, 2], nanos: [100, 99, 0] },
        { name: 'value', values: [10, 20, 30] },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const { filteredRows: filtered } = applyFilter(frameToRecords(frame), {}, frame.fields, false);
    expect(filtered).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
      { time: 2, value: 30 },
    ]);
  });

  it('filters the records by the filter columns', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1, 2],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);
    const { filteredRows: filtered } = applyFilter(
      records,
      { time: { filteredSet: new Set(['1']), displayName: 'time' } },
      frame.fields,
      false
    );
    expect(filtered).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
    ]);
  });

  it('supports multiple filter columns', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.number,
          values: [1, 2, 3],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const { filteredRows: filtered } = applyFilter(
      frameToRecords(frame),
      {
        time: { filteredSet: new Set(['1', '2']), displayName: 'time' },
        value: { filteredSet: new Set(['10']), displayName: 'value' },
      },
      frame.fields,
      false
    );
    expect(filtered).toMatchObject([{ time: 1, value: 10 }]);
  });

  it('filters the records by the filter columns with a nested frame', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1, 2],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
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
    const records = frameToRecords(frame);
    const { filteredRows: filtered } = applyFilter(
      records,
      {
        time: { filteredSet: new Set(['1']), displayName: 'time' },
        value2: { filteredSet: new Set(['10']), displayName: 'value2' },
      },
      frame.fields,
      true
    );

    // the filter method won't filter the values in the nested data frame's "fields" here. useNestedRows calls applyFilter on the nested rows.
    expect(filtered).toMatchObject([
      { time: 1, value: 10, __depth: 0 },
      { __index: 0, __depth: 1 },
      { time: 1, value: 20, __depth: 0 },
      { __index: 1, __depth: 1 },
    ]);
  });

  it('ignores scoped filter entries when parentIndex is not passed (regression: useNestedRows must pass parentIndex)', () => {
    // This is the bug: calling applyFilter without parentIndex when all filter entries have
    // parentIndex set causes them to be treated as top-level and silently skipped, leaving
    // the nested table unfiltered. The fix is to always pass parentRow.__index.
    const frame = createDataFrame({
      fields: [
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName), 'nested');
    const records = frameToRecords(frame, 5);

    // Bug: no parentIndex arg — scoped filter is ignored, all rows returned
    const { filteredRows: buggy } = applyFilter(
      records,
      { value: { filteredSet: new Set(['10']), displayName: 'value', parentIndex: 5 } },
      frame.fields,
      false
    );
    expect(buggy).toHaveLength(3); // filter had no effect

    // Fix: pass parentIndex — scoped filter is applied correctly
    const { filteredRows: fixed } = applyFilter(
      records,
      { value: { filteredSet: new Set(['10']), displayName: 'value', parentIndex: 5 } },
      frame.fields,
      false,
      5
    );
    expect(fixed).toHaveLength(1);
    expect(fixed).toMatchObject([{ value: 10 }]);
  });

  it('filters the records by the filter columns with a nested frame and a parent index', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1, 2],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName), 'nested');
    const records = frameToRecords(frame, 3);
    const { filteredRows: filtered } = applyFilter(
      records,
      { time: { filteredSet: new Set(['1']), displayName: 'time', parentIndex: 3 } },
      frame.fields,
      false,
      3
    );
    expect(filtered).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
    ]);

    // using a parent index that doesn't match the rows in the set, the rows should not be filtered.
    const { filteredRows: filtered2 } = applyFilter(
      records,
      { time: { filteredSet: new Set(['1']), displayName: 'time', parentIndex: 2 } },
      frame.fields,
      false
    );
    expect(filtered2).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
      { time: 2, value: 30 },
    ]);
  });

  it('does not mutate the original records', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1, 1, 2],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 20, 30],
          display: (v) => ({ text: String(v), numeric: NaN }),
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);
    const { filteredRows: filtered } = applyFilter(
      records,
      { time: { filteredSet: new Set(['1']), displayName: 'time' } },
      frame.fields,
      false
    );
    expect(records).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
      { time: 2, value: 30 },
    ]);
    expect(filtered).toMatchObject([
      { time: 1, value: 10 },
      { time: 1, value: 20 },
    ]);
  });
});

describe('cross-filter metadata', () => {
  const makeField = (name: string, values: unknown[]) => ({
    name,
    type: FieldType.string,
    values,
    config: {},
    display: (v: unknown) => ({ text: String(v), numeric: NaN }),
  });

  const makeRows = (values: Array<{ category: string; status: string }>): TableRow[] =>
    values.map((v, i) => ({ __depth: 0, __index: i, category: v.category, status: v.status }));

  const rows = makeRows([
    { category: 'A', status: 'up' },
    { category: 'A', status: 'down' },
    { category: 'B', status: 'up' },
    { category: 'B', status: 'down' },
    { category: 'C', status: 'up' },
  ]);

  const fields = [
    makeField('category', ['A', 'A', 'B', 'B', 'C']),
    makeField('status', ['up', 'down', 'up', 'down', 'up']),
  ];

  it('returns empty crossFilterOrder and full rows as tail when no filters active', () => {
    const { crossFilterOrder, crossFilterTailRows } = applyFilter(rows, {}, fields);
    expect(crossFilterOrder).toEqual([]);
    expect(crossFilterTailRows).toHaveLength(rows.length);
  });

  it('stores all rows before the first filter and the filtered subset as tail', () => {
    const filter = {
      category: { filteredSet: new Set(['A']), displayName: 'category' },
    };
    const { crossFilterOrder, crossFilterRows, crossFilterTailRows } = applyFilter(rows, filter, fields);
    expect(crossFilterOrder).toEqual(['category']);
    // before the first filter: all rows
    expect(crossFilterRows['category']).toHaveLength(5);
    // tail: only rows with category A
    expect(crossFilterTailRows).toHaveLength(2);
    expect(crossFilterTailRows.every((r) => r['category'] === 'A')).toBe(true);
  });

  it('builds a cascading chain for multiple filters', () => {
    const filter = {
      category: { filteredSet: new Set(['A', 'B']), displayName: 'category' },
      status: { filteredSet: new Set(['up']), displayName: 'status' },
    };
    const { crossFilterOrder, crossFilterRows, crossFilterTailRows } = applyFilter(rows, filter, fields);
    expect(crossFilterOrder).toEqual(['category', 'status']);
    // before category filter: all 5 rows
    expect(crossFilterRows['category']).toHaveLength(5);
    // before status filter: rows passing category (A or B) = 4 rows
    expect(crossFilterRows['status']).toHaveLength(4);
    // tail: rows passing both = A-up and B-up
    expect(crossFilterTailRows).toHaveLength(2);
  });

  it('scopes top-level cross-filter to depth-0 rows only', () => {
    const mixedRows: TableRow[] = [
      ...rows,
      // simulate a depth-1 nested container row that should be ignored
      { __depth: 1, __index: 0 },
    ];
    const filter = {
      category: { filteredSet: new Set(['A']), displayName: 'category' },
    };
    const { crossFilterRows } = applyFilter(mixedRows, filter, fields);
    // depth-1 row must not be counted
    expect(crossFilterRows['category']).toHaveLength(5);
  });

  it('scopes nested cross-filter to matching parentIndex only', () => {
    const nestedRows: TableRow[] = [
      { __depth: 0, __index: 0, __parentIndex: 7, category: 'A', status: 'up' },
      { __depth: 0, __index: 1, __parentIndex: 7, category: 'B', status: 'down' },
      { __depth: 0, __index: 2, __parentIndex: 7, category: 'A', status: 'down' },
    ];
    const filter = {
      'category-7': { filteredSet: new Set(['A']), displayName: 'category', parentIndex: 7 },
    };
    const { crossFilterOrder, crossFilterRows, crossFilterTailRows } = applyFilter(
      nestedRows,
      filter,
      fields,
      false,
      7
    );
    expect(crossFilterOrder).toEqual(['category-7']);
    // before the filter: all 3 nested rows
    expect(crossFilterRows['category-7']).toHaveLength(3);
    // tail: only the 2 rows with category A
    expect(crossFilterTailRows).toHaveLength(2);
  });

  it('ignores filters from a different nesting scope', () => {
    const filter = {
      // top-level filter — should be ignored when parentIndex=7 is requested
      category: { filteredSet: new Set(['A']), displayName: 'category' },
      'status-7': { filteredSet: new Set(['up']), displayName: 'status', parentIndex: 7 },
    };
    const { crossFilterOrder } = applyFilter(rows, filter, fields, false, 7);
    // only the nested filter for parentIndex 7 should appear
    expect(crossFilterOrder).toEqual(['status-7']);
  });
});
