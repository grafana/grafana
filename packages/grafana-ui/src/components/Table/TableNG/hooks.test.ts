import { act, renderHook } from '@testing-library/react';
import { varPreLine } from 'uwrap';

import { cacheFieldDisplayNames, createDataFrame, Field, FieldType } from '@grafana/data';

import {
  useFilteredRows,
  usePaginatedRows,
  useSortedRows,
  useFooterCalcs,
  useHeaderHeight,
  useTypographyCtx,
} from './hooks';

jest.mock('uwrap', () => ({
  // ...jest.requireActual('uwrap'),
  varPreLine: jest.fn(() => ({
    count: jest.fn(() => 1),
  })),
}));

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
      const { result } = renderHook(() => useFilteredRows(rows, fields, { hasNestedFrames: false }));
      expect(result.current.rows[0].name).toBe('Alice');
    });

    it('should apply filters correctly', () => {
      const { fields, rows } = setupData();
      const { result } = renderHook(() => useFilteredRows(rows, fields, { hasNestedFrames: false }));

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
      const { result } = renderHook(() => useFilteredRows(rows, fields, { hasNestedFrames: false }));

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

    it.todo('should handle nested frames');
  });

  describe('useSortedRows', () => {
    it('should correctly set up the table with an initial sort', () => {
      const { fields, rows } = setupData();
      const { result } = renderHook(() =>
        useSortedRows(rows, fields, {
          hasNestedFrames: false,
          initialSortBy: [{ displayName: 'age', desc: false }],
        })
      );

      // Initial state checks
      expect(result.current.sortColumns).toEqual([{ columnKey: 'age', direction: 'ASC' }]);
      expect(result.current.rows[0].name).toBe('Bob');
    });

    it('should change the sort on setSortColumns', () => {
      const { fields, rows } = setupData();
      const { result } = renderHook(() =>
        useSortedRows(rows, fields, {
          hasNestedFrames: false,
          initialSortBy: [{ displayName: 'age', desc: false }],
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

    it.todo('should handle nested frames');
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
          headerHeight: 28,
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
          headerHeight: 28,
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
  });

  describe('useFooterCalcs', () => {
    const rows = [
      { 'Field 1': 1, Text: 'a', __depth: 0, __index: 0 },
      { 'Field 1': 2, Text: 'b', __depth: 0, __index: 1 },
      { 'Field 1': 3, Text: 'c', __depth: 0, __index: 2 },
      { 'Field 2': 3, Text: 'd', __depth: 0, __index: 3 },
      { 'Field 2': 10, Text: 'e', __depth: 0, __index: 4 },
    ];

    const numericField: Field = {
      name: 'Field1',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {
        custom: {},
        displayName: 'Field 1',
      },
      display: (value: unknown) => ({
        text: String(value),
        numeric: Number(value),
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      }),
      getLinks: undefined,
    };

    const numericField2: Field = {
      name: 'Field2',
      type: FieldType.number,
      values: [3, 10],
      config: {
        custom: {},
        displayName: 'Field 2',
      },
      display: (value: unknown) => ({
        text: String(value),
        numeric: Number(value),
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      }),
      getLinks: undefined,
    };

    const textField: Field = {
      name: 'Text',
      type: FieldType.string,
      values: ['a', 'b', 'c'],
      config: { custom: {} },
      display: (value: unknown) => ({
        text: String(value),
        numeric: 0,
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      }),
      getLinks: undefined,
    };

    it('should calculate sum for numeric fields', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'] },
        });
      });

      expect(result.current).toEqual(['Total', '6']); // 1 + 2 + 3
    });

    it('should calculate mean for numeric fields', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['mean'] },
        });
      });

      expect(result.current).toEqual(['Mean', '2']); // (1 + 2 + 3) / 3
    });

    it('should return an empty string for non-numeric fields', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, textField] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'] },
        });
      });

      expect(result.current).toEqual(['Total', '']);
    });

    it('should return empty array if no footerOptions are provided', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: undefined,
        });
      });

      expect(result.current).toEqual([]);
    });

    it('should return empty array when footer is disabled', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: false,
          footerOptions: { show: true, reducer: ['sum'] },
        });
      });

      expect(result.current).toEqual([]);
    });

    it('should return empty array when reducer is undefined', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, textField] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: undefined },
        });
      });

      expect(result.current).toEqual([]);
    });

    it('should return empty array when reducer is empty', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: [] },
        });
      });

      expect(result.current).toEqual([]);
    });

    it('should return empty string if fields array doesnt include this field', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'], fields: ['Field2', 'Field3'] },
        });
      });

      expect(result.current).toEqual(['Total', '', '13']);
    });

    it('should return the calculation if fields array includes this field', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'], fields: ['Field1', 'Field2', 'Field3'] },
        });
      });

      expect(result.current).toEqual(['Total', '6', '13']);
    });

    it('should return the calculation if fields array includes this field by either name or display name', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [textField, numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'], fields: ['Field1', 'Field 2'] },
        });
      });

      expect(result.current).toEqual(['Total', '6', '13']);
    });

    it('should not return the reducer label in the first column if there is a calc to render', () => {
      const { result } = renderHook(() => {
        const data = createDataFrame({ fields: [numericField, numericField2] });
        cacheFieldDisplayNames([data]);
        return useFooterCalcs(rows, data.fields, {
          enabled: true,
          footerOptions: { show: true, reducer: ['sum'], fields: [] },
        });
      });

      expect(result.current).toEqual(['6', '13']);
    });
  });

  describe('useHeaderHeight', () => {
    it('should return 0 when no header is present', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        const typographyCtx = useTypographyCtx();
        return useHeaderHeight({
          fields,
          columnWidths: [],
          enabled: false,
          typographyCtx,
          defaultHeight: 28,
          sortColumns: [],
        });
      });
      expect(result.current).toBe(0);
    });

    it('should return the default height when wrap is disabled', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        const typographyCtx = useTypographyCtx();
        return useHeaderHeight({
          fields,
          columnWidths: [],
          enabled: true,
          typographyCtx,
          defaultHeight: 28,
          sortColumns: [],
        });
      });
      expect(result.current).toBe(22);
    });

    it('should return the appropriate height for wrapped text', () => {
      // Simulate 2 lines of text
      jest.mocked(varPreLine).mockReturnValue({
        count: jest.fn(() => 2),
        each: jest.fn(),
        split: jest.fn(),
        test: jest.fn(),
      });

      const { fields } = setupData();
      const { result } = renderHook(() => {
        const typographyCtx = useTypographyCtx();
        return useHeaderHeight({
          fields: fields.map((field) => {
            if (field.name === 'name') {
              return {
                ...field,
                name: 'Longer name that needs wrapping',
                config: {
                  ...field.config,
                  custom: {
                    ...field.config?.custom,
                    wrapHeaderText: true,
                  },
                },
              };
            }
            return field;
          }),
          columnWidths: [100, 100, 100],
          enabled: true,
          typographyCtx: { ...typographyCtx, avgCharWidth: 5 },
          defaultHeight: 28,
          sortColumns: [],
        });
      });

      expect(result.current).toBe(50);
    });

    it('should calculate the available width for a header cell based on the icons rendered within it', () => {
      const countFn = jest.fn(() => 1);

      // Simulate 2 lines of text
      jest.mocked(varPreLine).mockReturnValue({
        count: countFn,
        each: jest.fn(),
        split: jest.fn(),
        test: jest.fn(),
      });

      const { fields } = setupData();

      renderHook(() => {
        const typographyCtx = useTypographyCtx();

        return useHeaderHeight({
          fields: fields.map((field) => {
            if (field.name === 'name') {
              return {
                ...field,
                name: 'Longer name that needs wrapping',
                config: {
                  ...field.config,
                  custom: {
                    ...field.config?.custom,
                    wrapHeaderText: true,
                  },
                },
              };
            }
            return field;
          }),
          columnWidths: [100, 100, 100],
          enabled: true,
          typographyCtx: { ...typographyCtx, avgCharWidth: 10 },
          defaultHeight: 28,
          sortColumns: [],
          showTypeIcons: false,
        });
      });

      expect(countFn).toHaveBeenCalledWith('Longer name that needs wrapping', 87);

      renderHook(() => {
        const typographyCtx = useTypographyCtx();
        return useHeaderHeight({
          fields: fields.map((field) => {
            if (field.name === 'name') {
              return {
                ...field,
                name: 'Longer name that needs wrapping',
                config: {
                  ...field.config,
                  custom: {
                    ...field.config?.custom,
                    filterable: true,
                    wrapHeaderText: true,
                  },
                },
              };
            }
            return field;
          }),
          columnWidths: [100, 100, 100],
          enabled: true,
          typographyCtx: { ...typographyCtx, avgCharWidth: 10 },
          defaultHeight: 28,
          sortColumns: [{ columnKey: 'Longer name that needs wrapping', direction: 'ASC' }],
          showTypeIcons: true,
        });
      });

      expect(countFn).toHaveBeenCalledWith('Longer name that needs wrapping', 27);
    });
  });
});
