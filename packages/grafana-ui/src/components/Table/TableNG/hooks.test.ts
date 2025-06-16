import { act, renderHook } from '@testing-library/react';

import { Field, FieldType } from '@grafana/data';

import { useFilteredRows, usePaginatedRows, useSortedRows } from './hooks';

describe('TableNG hooks', () => {
  function setupData() {
    // Mock data for testing
    const fields: Field[] = [
      {
        name: 'name',
        type: FieldType.string,
        display: (v) => ({ text: v as string, numeric: NaN }),
        config: {},
        values: [],
      },
      {
        name: 'age',
        type: FieldType.number,
        display: (v) => ({ text: (v as number).toString(), numeric: v as number }),
        config: {},
        values: [],
      },
      {
        name: 'active',
        type: FieldType.boolean,
        display: (v) => ({ text: (v as boolean).toString(), numeric: NaN }),
        config: {},
        values: [],
      },
    ];

    const rows = [
      { name: 'Alice', age: 30, active: true, __depth: 0, __index: 0 },
      { name: 'Bob', age: 25, active: false, __depth: 0, __index: 1 },
      { name: 'Charlie', age: 35, active: true, __depth: 0, __index: 2 },
    ];

    return { fields, rows };
  }

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
          name: { filteredSet: new Set(['Alice']) },
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
          name: { filteredSet: new Set(['Alice']) },
        });
      });

      expect(result.current.rows.length).toBe(1);

      act(() => {
        result.current.setFilter({});
      });

      expect(result.current.rows.length).toBe(3);
    });
  });

  describe('useSortedRows', () => {
    it('should correctly set up the table with an initial sort', () => {
      const { fields, rows } = setupData();
      const { result } = renderHook(() =>
        useSortedRows(rows, fields, { initialSortBy: [{ displayName: 'age', desc: false }] })
      );

      // Initial state checks
      expect(result.current.sortColumns).toEqual([{ columnKey: 'age', direction: 'ASC' }]);
      expect(result.current.rows[0].name).toBe('Bob');
    });

    it('should change the sort on setSortColumns', () => {
      const { fields, rows } = setupData();
      const { result } = renderHook(() =>
        useSortedRows(rows, fields, { initialSortBy: [{ displayName: 'age', desc: false }] })
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
  });

  describe('usePaginatedRows', () => {
    it('should return defaults for pagination values when pagination is disabled', () => {
      const { rows } = setupData();
      const { result } = renderHook(() =>
        usePaginatedRows(rows, { rowHeight: 30, height: 300, width: 800, enabled: false })
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
  });
});
