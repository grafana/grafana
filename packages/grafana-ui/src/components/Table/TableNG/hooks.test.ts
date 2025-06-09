import { act, renderHook } from '@testing-library/react';

import { Field, FieldType } from '@grafana/data';

import { TableSortByFieldState } from '../types';

import { useTableFiltersAndSorts } from './hooks';

describe('TableNG hooks', () => {
  function setupHook(initialSortBy: TableSortByFieldState[] = []) {
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

    // Mock the hooks
    return renderHook(() => useTableFiltersAndSorts(rows, fields, initialSortBy));
  }

  it('should correctly initialize with provided fields and rows', () => {
    const { result } = setupHook();
    expect(result.current.renderedRows[0].name).toBe('Alice');
  });

  describe('sorting', () => {
    it('should correctly set up the table with an initial sort', () => {
      const { result } = setupHook([{ displayName: 'age', desc: false }]);

      // Initial state checks
      expect(result.current.sortColumns).toEqual([{ columnKey: 'age', direction: 'ASC' }]);
      expect(result.current.renderedRows[0].name).toBe('Bob');
      expect(result.current.filter).toEqual({});
    });

    it('should change the sort on setSortColumns', () => {
      const { result } = setupHook([{ displayName: 'age', desc: false }]);

      expect(result.current.renderedRows[0].name).toBe('Bob');

      act(() => {
        result.current.setSortColumns([{ columnKey: 'age', direction: 'DESC' }]);
      });

      expect(result.current.renderedRows[0].name).toBe('Charlie');

      act(() => {
        result.current.setSortColumns([{ columnKey: 'name', direction: 'ASC' }]);
      });

      expect(result.current.renderedRows[0].name).toBe('Alice');
    });
  });

  describe('filtering', () => {
    it('should apply filters correctly', () => {
      const { result } = setupHook();

      act(() => {
        result.current.setFilter({
          name: { filteredSet: new Set(['Alice']) },
        });
      });

      expect(result.current.renderedRows.length).toBe(1);
      expect(result.current.renderedRows[0].name).toBe('Alice');
    });

    it('should clear filters correctly', () => {
      const { result } = setupHook();

      act(() => {
        result.current.setFilter({
          name: { filteredSet: new Set(['Alice']) },
        });
      });

      expect(result.current.renderedRows.length).toBe(1);

      act(() => {
        result.current.setFilter({});
      });

      expect(result.current.renderedRows.length).toBe(3);
    });
  });
});
