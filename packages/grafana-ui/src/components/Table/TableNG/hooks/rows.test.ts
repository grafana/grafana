import { act, renderHook } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { TABLE } from '../constants';
import { compileFrameToRecords } from '../utils/rows';

import {
  useFilteredRows,
  useManagedSort,
  useNestedRows,
  usePaginatedRows,
  useRowCompiler,
  useSortedRows,
} from './rows';
import { setupData } from './testHelpers';

describe('useFilteredRows', () => {
  it('should correctly initialize with provided fields and rows', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));
    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should apply filters correctly', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));

    act(() => {
      result.current.setFilter({
        name: { filteredSet: new Set(['Alice']), displayName: 'name' },
      });
    });

    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should clear filters correctly', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));

    act(() => {
      result.current.setFilter({
        name: { filteredSet: new Set(['Alice']), displayName: 'name' },
      });
    });

    expect(result.current.rows.length).toBe(1);

    act(() => {
      result.current.setFilter({});
    });

    expect(result.current.rows.length).toBe(3);
  });
});

describe('useManagedSort', () => {
  it('Should not update if sortBy is undefined', () => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: undefined,
        sortByBehavior: 'managed',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(0);
  });

  it.each([true, false])('Should not update if behavior is managed', (desc) => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: [
          {
            displayName: 'Alice',
            desc,
          },
        ],
        sortByBehavior: 'managed',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(1);
    expect(setSortColumns).toHaveBeenCalledWith([
      {
        columnKey: 'Alice',
        direction: desc ? 'DESC' : 'ASC',
      },
    ]);
  });

  it.each([true, false])('Should not update if behavior is initial', (desc) => {
    const setSortColumns = jest.fn();
    renderHook(() =>
      useManagedSort({
        sortBy: [
          {
            displayName: 'Alice',
            desc,
          },
        ],
        sortByBehavior: 'initial',
        setSortColumns,
      })
    );

    expect(setSortColumns).toHaveBeenCalledTimes(0);
  });
});

describe('useSortedRows', () => {
  it('should correctly set up the table with an initial sort', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() =>
      useSortedRows(rows, fields, [], {
        initialSortBy: [{ displayName: 'age', desc: false }],
        hasNestedFrames: false,
      })
    );

    // Initial state checks
    expect(result.current.sortColumns).toEqual([{ columnKey: 'age', direction: 'ASC' }]);
    expect(result.current.rows[0].name).toBe('Bob');
  });

  it('should change the sort on setSortColumns', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() =>
      useSortedRows(rows, fields, [], {
        initialSortBy: [{ displayName: 'age', desc: false }],
        hasNestedFrames: false,
      })
    );

    expect(result.current.rows[0].name).toBe('Bob');

    act(() => {
      result.current.setSortColumns([{ columnKey: 'age', direction: 'DESC' }]);
    });

    expect(result.current.rows[0].name).toBe('Charlie');

    act(() => {
      result.current.setSortColumns([{ columnKey: 'name', direction: 'ASC' }]);
    });

    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should allow initial sort by nested fields', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.number, values: [1, 3, 2], config: {} },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: [[createDataFrame({ fields })], [createDataFrame({ fields })], [createDataFrame({ fields })]],
          config: {},
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const rows = frameToRecords(frame);
    const { result } = renderHook(() =>
      useSortedRows(rows, frame.fields, fields, {
        initialSortBy: [
          { displayName: 'id', desc: false },
          { displayName: 'age', desc: false },
          { displayName: 'some-fake-name', desc: false },
        ],
        hasNestedFrames: true,
      })
    );
    expect(result.current.rows[0].id).toBe(1);
    expect(result.current.rows[2].id).toBe(2);
    expect(result.current.rows[4].id).toBe(3);

    // sort for the nested rows is handled elsewhere, and tested elsewhere. the most important thing is that the sort columns are set correctly
    // and that `age` is permitted as a sort column since it's from a nested field, and that `some-fake-name` is not permitted and is ignored.
    expect(result.current.sortColumns).toEqual([
      { columnKey: 'id', direction: 'ASC' },
      { columnKey: 'age', direction: 'ASC' },
    ]);
  });
});

describe('usePaginatedRows', () => {
  it('should return defaults for pagination values when pagination is disabled', () => {
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        rowHeight: 30,
        height: 300,
        width: 800,
        enabled: false,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 0,
      })
    );

    expect(result.current.page).toBe(-1);
    expect(result.current.rowsPerPage).toBe(0);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(3);
  });

  it('should handle pagination correctly', () => {
    // with the numbers provided here, we have 3 rows, with 2 rows per page, over 2 pages total.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 60,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should handle header and footer correctly', () => {
    // with the numbers provided here, we have 3 rows, with 2 rows per page, over 2 pages total.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 140,
        width: 800,
        rowHeight: 10,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 45,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should handle nested frames correctly', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1', '2', '3', '4', '5'], config: {} },
        {
          name: 'nested',
          type: FieldType.nestedFrames,
          values: Array(5).fill([[createDataFrame({ fields })]]),
          config: {},
        },
      ],
    });
    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const rows = frameToRecords(frame);
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 140,
        width: 800,
        rowHeight: 10,
        headerHeight: TABLE.HEADER_HEIGHT,
        footerHeight: 45,
        hasNestedFrames: true,
      })
    );

    expect(result.current.page).toBe(0);
    expect(result.current.rows.length).toBe(4);
    expect(result.current.rows[0].__index).toBe(0);
    expect(result.current.rows[1].__index).toBe(0);
    expect(result.current.rows[2].__index).toBe(1);
    expect(result.current.rows[3].__index).toBe(1);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rowsPerPage).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.rows.length).toBe(4);
    expect(result.current.rows[0].__index).toBe(2);
    expect(result.current.rows[1].__index).toBe(2);
    expect(result.current.rows[2].__index).toBe(3);
    expect(result.current.rows[3].__index).toBe(3);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(4);
    expect(result.current.rowsPerPage).toBe(2);

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);
    expect(result.current.rows.length).toBe(2);
    expect(result.current.rows[0].__index).toBe(4);
    expect(result.current.rows[1].__index).toBe(4);
    expect(result.current.pageRangeStart).toBe(5);
    expect(result.current.pageRangeEnd).toBe(5);
    expect(result.current.rowsPerPage).toBe(2);
  });

  it('should use pageSize for rowsPerPage instead of deriving it from the panel height', () => {
    // height alone would fit all 3 rows on one page ((300 - 38) / 10 = 26 rows); pageSize must win.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 300,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 2,
      })
    );

    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.numPages).toBe(2);
    expect(result.current.pageRangeStart).toBe(1);
    expect(result.current.pageRangeEnd).toBe(2);
    expect(result.current.rows.length).toBe(2);

    act(() => {
      result.current.setPage(1);
    });

    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].__index).toBe(2);
  });

  it('should fall back to the height-derived page size when pageSize is not a positive number', () => {
    // (60 - 38) / 10 = 2 rows per page from height; pageSize: 0 must not override that.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 60,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 0,
      })
    );

    expect(result.current.rowsPerPage).toBe(2);
    expect(result.current.numPages).toBe(2);
  });

  it('should clamp a fractional pageSize in (0, 1) to one row per page instead of flooring to 0', () => {
    // pageSize 0.5 is positive but floors to 0; without a guard that yields numPages = Infinity and crashes Pagination.
    const { rows } = setupData();
    const { result } = renderHook(() =>
      usePaginatedRows(rows, {
        enabled: true,
        height: 300,
        width: 800,
        rowHeight: 10,
        headerHeight: 0,
        footerHeight: 0,
        pageSize: 0.5,
      })
    );

    expect(result.current.rowsPerPage).toBe(1);
    expect(result.current.numPages).toBe(3);
    expect(result.current.rows.length).toBe(1);
  });

  it('should clamp the page to the last valid page when pageSize grows and drops the page count', () => {
    // 3 rows. pageSize 1 -> 3 pages (indices 0..2); land on the last page.
    const { rows } = setupData();
    const { result, rerender } = renderHook(
      ({ pageSize }) =>
        usePaginatedRows(rows, {
          enabled: true,
          height: 300,
          width: 800,
          rowHeight: 10,
          headerHeight: 0,
          footerHeight: 0,
          pageSize,
        }),
      { initialProps: { pageSize: 1 } }
    );

    expect(result.current.numPages).toBe(3);

    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);

    // pageSize 2 -> 2 pages (indices 0..1). page 2 now overflows and must snap to the last valid page,
    // rather than sitting on an empty page with a broken range summary.
    rerender({ pageSize: 2 });

    expect(result.current.numPages).toBe(2);
    expect(result.current.page).toBe(1);
    expect(result.current.pageRangeStart).toBe(3);
    expect(result.current.pageRangeEnd).toBe(3);
    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].__index).toBe(2);
  });
});

describe('useNestedRows', () => {
  it('should return the nested rows', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1'], config: {} },
        { name: 'nested', type: FieldType.nestedFrames, values: [[createDataFrame({ fields })]], config: {} },
      ],
    });

    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const parentRows = frameToRecords(frame);
    const { result } = renderHook(() =>
      useNestedRows(
        parentRows,
        frame.fields[1].values.map((v) => v[0]),
        true,
        'nested',
        {},
        []
      )
    );
    expect(result.current[0].raw[0].name).toBe('Alice');
    expect(result.current[0].raw[0].age).toBe(30);
    expect(result.current[0].raw[0].active).toBe(true);

    expect(result.current[0].raw[1].name).toBe('Bob');
    expect(result.current[0].raw[1].age).toBe(25);
    expect(result.current[0].raw[1].active).toBe(false);

    expect(result.current[0].raw[2].name).toBe('Charlie');
    expect(result.current[0].raw[2].age).toBe(35);
    expect(result.current[0].raw[2].active).toBe(true);
  });

  it('should apply sorting and filtering', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1'], config: {} },
        { name: 'nested', type: FieldType.nestedFrames, values: [[createDataFrame({ fields })]], config: {} },
      ],
    });

    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );

    // parentIndex must be set on the filter entry — this is how the UI always scopes filters
    // for nested tables. Without it the filter is silently skipped (regression test).
    const { result } = renderHook(() =>
      useNestedRows(
        frameToRecords(frame),
        frame.fields[1].values[0],
        true,
        'nested',
        { 'name-0': { filteredSet: new Set(['Alice', 'Bob']), displayName: 'name', parentIndex: 0 } },
        [{ columnKey: 'age', direction: 'ASC' }]
      )
    );

    // filtering reduced raw (3 rows) to final (2 rows: Alice + Bob), sorted by age ASC
    expect(result.current[0].raw).toHaveLength(3);
    expect(result.current[0].final).toHaveLength(2);
    expect(result.current[0].final.map((r) => r['name'])).toEqual(['Bob', 'Alice']);
  });
});

describe('useRowCompiler', () => {
  it('returns a converter that maps a frame to rows with column getters and metadata', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.number, values: [1, 2] },
        { name: 'value', type: FieldType.string, values: ['a', 'b'] },
      ],
    });

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 'a' });
    expect(rows[1]).toMatchObject({ __depth: 0, __index: 1, time: 2, value: 'b' });
  });

  it('resolves column keys from the display name rather than the raw field name', () => {
    const frame = createDataFrame({
      fields: [{ name: 'raw', type: FieldType.number, values: [1] }],
    });
    // getDisplayName reads field.state.displayName; set it directly since
    // createDataFrame does not derive it from config here.
    frame.fields[0].state = { displayName: 'Display' };

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame);

    expect(rows[0].Display).toBe(1);
  });

  it('emits an expander placeholder row for non-empty nested frames and hides the nested column', () => {
    const child = createDataFrame({
      fields: [{ name: 'inner', type: FieldType.number, values: [10] }],
    });
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['x', 'y'] },
        { name: 'nested', type: FieldType.nestedFrames, values: [[child], undefined] },
      ],
    });

    const { result } = renderHook(() => useRowCompiler(frame, 'nested'));
    const rows = result.current(frame);

    // 'x' has a nested frame -> data row + expander placeholder; 'y' has none -> data row only.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ __depth: 0, __index: 0, id: 'x' });
    expect(rows[1]).toMatchObject({ __depth: 1, __index: 0 });
    expect(rows[2]).toMatchObject({ __depth: 0, __index: 1, id: 'y' });
    // the nested-frames column is not exposed as a data key.
    expect(rows[0].nested).toBeUndefined();
  });

  it('tags rows with __parentIndex when a nested row index is passed to the converter', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }],
    });

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame, 7);

    expect(rows[0].__parentIndex).toBe(7);
    expect(rows[1].__parentIndex).toBe(7);
  });

  it('returns a stable converter across re-renders when field names are unchanged', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(() => useRowCompiler(frame));
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('keeps the same converter when the frame identity changes but field names do not', () => {
    const makeFrame = () => createDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] });

    const { result, rerender } = renderHook(({ frame }) => useRowCompiler(frame), {
      initialProps: { frame: makeFrame() },
    });
    const first = result.current;

    rerender({ frame: makeFrame() });

    expect(result.current).toBe(first);
  });

  it('returns a new converter when the field display names change', () => {
    const frameA = createDataFrame({
      fields: [{ name: 'a', type: FieldType.number, values: [1] }],
    });
    const frameB = createDataFrame({
      fields: [{ name: 'b', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(({ frame }) => useRowCompiler(frame), {
      initialProps: { frame: frameA },
    });
    const first = result.current;

    rerender({ frame: frameB });

    expect(result.current).not.toBe(first);
  });

  it('returns a new converter when nestedFramesFieldName changes', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(
      ({ nestedName }: { nestedName?: string }) => useRowCompiler(frame, nestedName),
      { initialProps: { nestedName: undefined as string | undefined } }
    );
    const first = result.current;

    rerender({ nestedName: 'nested' });

    expect(result.current).not.toBe(first);
  });
});
