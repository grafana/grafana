import { act, renderHook } from '@testing-library/react';
import { SortDirection } from 'react-data-grid';

import { createDataFrame, FieldType } from '@grafana/data';

import { ColumnTypes, TableRow, TableSortByFieldState } from '../../types';
import { frameToRecords } from '../../utils';

import { useTableSorting } from './useTableSorting';

// Create test dataframe with multiple sortable fields
const createTestDataFrame = () => {
  return createDataFrame({
    fields: [
      {
        name: 'id',
        type: FieldType.number,
        values: [3, 1, 2, 5, 4],
        config: { custom: { displayMode: 'auto' } },
      },
      {
        name: 'name',
        type: FieldType.string,
        values: ['Charlie', 'Alice', 'Bob', 'Eve', 'Dave'],
        config: { custom: { displayMode: 'auto' } },
      },
      {
        name: 'score',
        type: FieldType.number,
        values: [70, 90, 85, 65, 80],
        config: { custom: { displayMode: 'auto' } },
      },
    ],
  });
};

describe('useTableSorting', () => {
  const defaultDataFrame = createTestDataFrame();
  const defaultRows = frameToRecords(defaultDataFrame) as TableRow[];
  const defaultColumnTypes: ColumnTypes = {
    id: FieldType.number,
    name: FieldType.string,
    score: FieldType.number,
  };
  const defaultSetRevId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state without any sorting', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    expect(result.current.sortColumns).toEqual([]);
    expect(result.current.sortedRows).toEqual(defaultRows);
    expect(result.current.nestedTableSortColumns).toEqual({});
  });

  it('should sort rows by the specified column ascending', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });

    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);

    // Verify rows are sorted by id in ascending order
    const sortedIds = result.current.sortedRows.map((row) => row.id);
    expect(sortedIds).toEqual([1, 2, 3, 4, 5]);
  });

  it('should sort rows by the specified column descending', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });

    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'DESC' }]);

    // Verify rows are sorted by id in descending order
    const sortedIds = result.current.sortedRows.map((row) => row.id);
    expect(sortedIds).toEqual([5, 4, 3, 2, 1]);
  });

  it('should clear sort when clicking the same column after descending sort', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // First sort ascending
    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);

    // Then sort descending
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'DESC' }]);

    // Then click again to clear sort
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([]);
  });

  it('should support multi-column sorting', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // First sort by score ascending
    act(() => {
      result.current.onSort('score', 'ASC' as SortDirection, true);
    });

    // Then add name sorting
    act(() => {
      result.current.onSort('name', 'ASC' as SortDirection, true);
    });

    expect(result.current.sortColumns).toEqual([
      { columnKey: 'score', direction: 'ASC' },
      { columnKey: 'name', direction: 'ASC' },
    ]);

    // Multi-sort should prioritize the first sort column
    const firstSortValue = result.current.sortedRows[0].score;
    expect(firstSortValue).toBe(65); // Lowest score
  });

  it('should call onSortByChange when sorting changes', () => {
    const onSortByChangeMock = jest.fn();
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
        onSortByChange: onSortByChangeMock,
      })
    );

    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });

    expect(onSortByChangeMock).toHaveBeenCalledWith([{ displayName: 'id', desc: false }]);

    // Change sort direction
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });

    expect(onSortByChangeMock).toHaveBeenCalledWith([{ displayName: 'id', desc: true }]);
  });

  it('should use initialSortBy if provided', () => {
    const initialSortBy: TableSortByFieldState[] = [{ displayName: 'name', desc: true }];

    // Update data frame to include state.displayName for matching
    const dataFrame = createTestDataFrame();
    dataFrame.fields.forEach((field) => {
      field.state = { displayName: field.name };
    });

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: dataFrame,
        filteredRows: defaultRows,
        initialSortBy,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    expect(result.current.sortColumns).toEqual([{ columnKey: 'name', direction: 'DESC' }]);

    // Verify rows are sorted by name in descending order
    const sortedNames = result.current.sortedRows.map((row) => row.name);
    expect(sortedNames[0]).toBe('Eve'); // Alphabetically last name
  });

  describe('nested table sorting', () => {
    it('should handle sorting for nested tables', () => {
      const { result } = renderHook(() =>
        useTableSorting({
          columnTypes: defaultColumnTypes,
          data: defaultDataFrame,
          filteredRows: defaultRows,
          isNestedTable: true,
          setRevId: defaultSetRevId,
        })
      );

      act(() => {
        result.current.handleNestedTableSort(1, [{ columnKey: 'score', direction: 'DESC' }]);
      });

      expect(result.current.nestedTableSortColumns).toEqual({
        1: [{ columnKey: 'score', direction: 'DESC' }],
      });
      expect(defaultSetRevId).toHaveBeenCalled();
    });

    it('should use the nested sort handler when onSort is called with a parent row index', () => {
      const { result } = renderHook(() =>
        useTableSorting({
          columnTypes: defaultColumnTypes,
          data: defaultDataFrame,
          filteredRows: defaultRows,
          isNestedTable: true,
          setRevId: defaultSetRevId,
        })
      );

      // Use the main onSort handler with a parentRowIdx to sort a nested table
      act(() => {
        result.current.onSort('name', 'ASC' as SortDirection, false, 2, true);
      });

      expect(result.current.nestedTableSortColumns).toEqual({
        2: [{ columnKey: 'name', direction: 'ASC' }],
      });
      expect(defaultSetRevId).toHaveBeenCalled();
    });

    it('should handle multiple levels of nested table sorting', () => {
      const { result } = renderHook(() =>
        useTableSorting({
          columnTypes: defaultColumnTypes,
          data: defaultDataFrame,
          filteredRows: defaultRows,
          isNestedTable: true,
          setRevId: defaultSetRevId,
        })
      );

      // Sort at different nesting levels
      act(() => {
        result.current.handleNestedTableSort(1, [{ columnKey: 'score', direction: 'DESC' }]);
        result.current.handleNestedTableSort(2, [{ columnKey: 'name', direction: 'ASC' }]);
      });

      expect(result.current.nestedTableSortColumns).toEqual({
        1: [{ columnKey: 'score', direction: 'DESC' }],
        2: [{ columnKey: 'name', direction: 'ASC' }],
      });

      // Verify setRevId is called for each nested sort change
      expect(defaultSetRevId).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle null or undefined values when sorting', () => {
    // Create dataframe with null values
    const dataFrameWithNulls = createDataFrame({
      fields: [
        {
          name: 'id',
          type: FieldType.number,
          values: [3, null, 2, undefined, 4],
          config: { custom: { displayMode: 'auto' } },
        },
      ],
    });

    const rowsWithNulls = frameToRecords(dataFrameWithNulls) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { id: FieldType.number },
        data: dataFrameWithNulls,
        filteredRows: rowsWithNulls,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });

    // Get the sorted values
    const sortedIds = result.current.sortedRows.map((row) => row.id);

    // Check if we have nulls at the beginning
    const firstValues = sortedIds.slice(0, 2);
    const numericValues = sortedIds.slice(2);

    // Verify nulls/undefined are handled and numeric values are in ascending order
    expect(firstValues).toContain(null);
    expect(firstValues).toContain(undefined);
    expect(numericValues).toEqual([2, 3, 4]);
  });

  it('should cycle through sort states (none → ASC → DESC → none)', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Initially no sorting
    expect(result.current.sortColumns).toEqual([]);

    // First click: ASC
    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);

    // Second click: DESC
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'DESC' }]);

    // Third click: None
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([]);
  });

  it('should handle different orders of multi-sort operations', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Sort by name DESC first
    act(() => {
      result.current.onSort('name', 'DESC' as SortDirection, false);
    });

    // Then add score ASC as secondary sort
    act(() => {
      result.current.onSort('score', 'ASC' as SortDirection, true);
    });

    expect(result.current.sortColumns).toEqual([
      { columnKey: 'name', direction: 'DESC' },
      { columnKey: 'score', direction: 'ASC' },
    ]);

    // Verify the sorting priority respects the order of operations
    const firstRow = result.current.sortedRows[0];
    expect(firstRow.name).toBe('Eve'); // Should be sorted by name first
  });

  it('should remove a column from multi-sort when cycling through sort states', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Set up multi-sort
    act(() => {
      result.current.onSort('name', 'ASC' as SortDirection, false);
      result.current.onSort('score', 'DESC' as SortDirection, true);
    });

    expect(result.current.sortColumns).toEqual([
      { columnKey: 'name', direction: 'ASC' },
      { columnKey: 'score', direction: 'DESC' },
    ]);

    // Remove 'name' from sort by cycling through states
    act(() => {
      result.current.onSort('name', 'DESC' as SortDirection, true);
      result.current.onSort('name', 'DESC' as SortDirection, true);
    });

    // Only 'score' should remain
    expect(result.current.sortColumns).toEqual([{ columnKey: 'score', direction: 'DESC' }]);
  });

  it('should handle date sorting correctly', () => {
    // Create dataframe with date values
    const dataFrameWithDates = createDataFrame({
      fields: [
        {
          name: 'date',
          type: FieldType.time,
          values: [
            new Date('2023-01-15').getTime(),
            new Date('2023-01-01').getTime(),
            new Date('2023-01-30').getTime(),
          ],
          config: { custom: { displayMode: 'auto' } },
        },
      ],
    });

    const rowsWithDates = frameToRecords(dataFrameWithDates) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { date: FieldType.time },
        data: dataFrameWithDates,
        filteredRows: rowsWithDates,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('date', 'ASC' as SortDirection, false);
    });

    // Verify dates are sorted correctly - handle potential undefined values
    const sortedDates = result.current.sortedRows.map((row) => {
      const dateValue = row.date as number;
      return dateValue ? new Date(dateValue).toISOString() : null;
    });
    expect(sortedDates[0]).toContain('2023-01-01');
    expect(sortedDates[2]).toContain('2023-01-30');
  });

  it('should handle empty dataset gracefully', () => {
    const emptyDataFrame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.number, values: [], config: { custom: { displayMode: 'auto' } } },
        { name: 'name', type: FieldType.string, values: [], config: { custom: { displayMode: 'auto' } } },
      ],
    });

    const emptyRows = frameToRecords(emptyDataFrame) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { id: FieldType.number, name: FieldType.string },
        data: emptyDataFrame,
        filteredRows: emptyRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });

    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);
    expect(result.current.sortedRows).toEqual([]);
  });

  it('should handle initialSortBy with no matching fields gracefully', () => {
    const initialSortBy: TableSortByFieldState[] = [{ displayName: 'nonexistent', desc: true }];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        initialSortBy,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Should have attempted to set sort columns based on initialSortBy
    expect(result.current.sortColumns.length).toBe(1);
    expect(result.current.sortColumns[0].columnKey).toBe('nonexistent');
    expect(result.current.sortColumns[0].direction).toBe('DESC');
  });

  it('should maintain sorting when filtered rows change', () => {
    // Set up initial hook with sorted data
    const { result, rerender } = renderHook(
      (props) =>
        useTableSorting({
          columnTypes: defaultColumnTypes,
          data: defaultDataFrame,
          filteredRows: props.filteredRows,
          isNestedTable: false,
          setRevId: defaultSetRevId,
        }),
      { initialProps: { filteredRows: defaultRows } }
    );

    // Apply initial sort
    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });

    // Verify initial sorting
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);
    const initialSortedIds = result.current.sortedRows.map((row) => row.id);
    expect(initialSortedIds).toEqual([1, 2, 3, 4, 5]);

    // Simulate filtered rows changing (e.g., from a filter being applied)
    const filteredSubset = defaultRows.filter((row) => {
      const id = row.id as number;
      return id > 2;
    });
    rerender({ filteredRows: filteredSubset });

    // Verify sort columns are maintained
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);

    // Verify new rows are still sorted
    const newSortedIds = result.current.sortedRows.map((row) => row.id);
    expect(newSortedIds).toEqual([3, 4, 5]);
  });

  it('should handle case-insensitive string sorting correctly', () => {
    // Create dataframe with mixed case strings
    const dataFrameWithMixedCase = createDataFrame({
      fields: [
        {
          name: 'text',
          type: FieldType.string,
          values: ['Zebra', 'apple', 'Banana', 'orange'],
          config: { custom: { displayMode: 'auto' } },
        },
      ],
    });

    const rowsWithMixedCase = frameToRecords(dataFrameWithMixedCase) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { text: FieldType.string },
        data: dataFrameWithMixedCase,
        filteredRows: rowsWithMixedCase,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('text', 'ASC' as SortDirection, false);
    });

    // Verify case-insensitive sorting (alphabetical regardless of case)
    const sortedTexts = result.current.sortedRows.map((row) => row.text);
    expect(sortedTexts).toEqual(['apple', 'Banana', 'orange', 'Zebra']);
  });

  it('should correctly handle boolean field sorting', () => {
    // Create dataframe with boolean values
    const dataFrameWithBooleans = createDataFrame({
      fields: [
        {
          name: 'active',
          type: FieldType.boolean,
          values: [true, false, true, false, true],
          config: { custom: { displayMode: 'auto' } },
        },
        {
          name: 'id',
          type: FieldType.number,
          values: [1, 2, 3, 4, 5],
          config: { custom: { displayMode: 'auto' } },
        },
      ],
    });

    const rowsWithBooleans = frameToRecords(dataFrameWithBooleans) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { active: FieldType.boolean, id: FieldType.number },
        data: dataFrameWithBooleans,
        filteredRows: rowsWithBooleans,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    act(() => {
      result.current.onSort('active', 'ASC' as SortDirection, false);
    });

    // Verify boolean sorting (false before true in ASC)
    const ids = result.current.sortedRows.map((row) => row.id);
    const firstGroup = ids.slice(0, 2);
    const secondGroup = ids.slice(2);

    // The first group should contain ids 2 and 4 (false values)
    // The second group should contain ids 1, 3, and 5 (true values)
    expect(firstGroup.sort()).toEqual([2, 4]);
    expect(secondGroup.sort()).toEqual([1, 3, 5]);
  });

  it('should handle initialSortBy with multiple fields', () => {
    const initialSortBy: TableSortByFieldState[] = [
      { displayName: 'name', desc: true },
      { displayName: 'score', desc: false },
    ];

    // Update data frame to include state.displayName for matching
    const dataFrame = createTestDataFrame();
    dataFrame.fields.forEach((field) => {
      field.state = { displayName: field.name };
    });

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: dataFrame,
        filteredRows: defaultRows,
        initialSortBy,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    expect(result.current.sortColumns).toEqual([
      { columnKey: 'name', direction: 'DESC' },
      { columnKey: 'score', direction: 'ASC' },
    ]);

    // Verify multi-sort is applied correctly
    const sortedNames = result.current.sortedRows.map((row) => row.name);
    expect(sortedNames[0]).toBe('Eve'); // Alphabetically last name
  });

  it('should handle changing sort column', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Sort by id first
    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });
    expect(result.current.sortColumns).toEqual([{ columnKey: 'id', direction: 'ASC' }]);

    // Then change to sort by name
    act(() => {
      result.current.onSort('name', 'ASC' as SortDirection, false);
    });

    // Should switch to name sorting and clear id sorting
    expect(result.current.sortColumns).toEqual([{ columnKey: 'name', direction: 'ASC' }]);

    // Verify rows are sorted by name
    const sortedNames = result.current.sortedRows.map((row) => row.name);
    expect(sortedNames).toEqual(['Alice', 'Bob', 'Charlie', 'Dave', 'Eve']);
  });

  it('should handle complex multi-column sorting with removal of middle column', () => {
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Set up three-column sorting
    act(() => {
      result.current.onSort('score', 'DESC' as SortDirection, false);
      result.current.onSort('name', 'ASC' as SortDirection, true);
      result.current.onSort('id', 'DESC' as SortDirection, true);
    });

    // Verify all three columns are in sort
    expect(result.current.sortColumns).toEqual([
      { columnKey: 'score', direction: 'DESC' },
      { columnKey: 'name', direction: 'ASC' },
      { columnKey: 'id', direction: 'DESC' },
    ]);

    // Now remove the middle column (name) by cycling through its sort states
    act(() => {
      result.current.onSort('name', 'DESC' as SortDirection, true);
      result.current.onSort('name', 'DESC' as SortDirection, true);
    });

    // Should still have score and id columns in sort
    expect(result.current.sortColumns).toEqual([
      { columnKey: 'score', direction: 'DESC' },
      { columnKey: 'id', direction: 'DESC' },
    ]);
  });

  it('should correctly apply onSortByChange callback with multi-sort', () => {
    const onSortByChangeMock = jest.fn();
    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: defaultColumnTypes,
        data: defaultDataFrame,
        filteredRows: defaultRows,
        isNestedTable: false,
        setRevId: defaultSetRevId,
        onSortByChange: onSortByChangeMock,
      })
    );

    // First sort
    act(() => {
      result.current.onSort('id', 'ASC' as SortDirection, false);
    });
    expect(onSortByChangeMock).toHaveBeenCalledWith([{ displayName: 'id', desc: false }]);
    onSortByChangeMock.mockClear();

    // Add second sort
    act(() => {
      result.current.onSort('name', 'DESC' as SortDirection, true);
    });
    expect(onSortByChangeMock).toHaveBeenCalledWith([
      { displayName: 'id', desc: false },
      { displayName: 'name', desc: true },
    ]);
    onSortByChangeMock.mockClear();

    // Remove a sort
    act(() => {
      result.current.onSort('id', 'DESC' as SortDirection, true);
      result.current.onSort('id', 'DESC' as SortDirection, true);
    });
    expect(onSortByChangeMock).toHaveBeenLastCalledWith([{ displayName: 'name', desc: true }]);
  });

  it('should handle extremely large values correctly', () => {
    // Create dataframe with very large numbers
    const dataFrameWithLargeNumbers = createDataFrame({
      fields: [
        {
          name: 'bignum',
          type: FieldType.number,
          values: [Number.MAX_SAFE_INTEGER, 1, -Number.MAX_SAFE_INTEGER, 0, 9007199254740991],
          config: { custom: { displayMode: 'auto' } },
        },
      ],
    });

    const rowsWithLargeNumbers = frameToRecords(dataFrameWithLargeNumbers) as TableRow[];

    const { result } = renderHook(() =>
      useTableSorting({
        columnTypes: { bignum: FieldType.number },
        data: dataFrameWithLargeNumbers,
        filteredRows: rowsWithLargeNumbers,
        isNestedTable: false,
        setRevId: defaultSetRevId,
      })
    );

    // Sort ascending
    act(() => {
      result.current.onSort('bignum', 'ASC' as SortDirection, false);
    });

    // Verify large numbers are sorted correctly
    const sortedNumbers = result.current.sortedRows.map((row) => row.bignum);
    expect(sortedNumbers[0]).toBe(-Number.MAX_SAFE_INTEGER);
    expect(sortedNumbers[sortedNumbers.length - 1]).toBe(Number.MAX_SAFE_INTEGER);
  });
});
