import { act, renderHook } from '@testing-library/react';

import { cacheFieldDisplayNames, createDataFrame, Field, FieldType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { TABLE } from './constants';
import {
  useFilteredRows,
  usePaginatedRows,
  useSortedRows,
  useFooterCalcs,
  useHeaderHeight,
  useRowHeight,
} from './hooks';
import { TableRow } from './types';
import { createTypographyContext } from './utils';

describe('TableNG hooks', () => {
  function setupData() {
    // Mock data for testing
    const fields: Field[] = [
      {
        name: 'name',
        type: FieldType.string,
        display: (v) => ({ text: v as string, numeric: NaN }),
        config: {},
        values: ['Alice', 'Bob', 'Charlie'],
      },
      {
        name: 'age',
        type: FieldType.number,
        display: (v) => ({ text: (v as number).toString(), numeric: v as number }),
        config: {},
        values: [30, 25, 35],
      },
      {
        name: 'active',
        type: FieldType.boolean,
        display: (v) => ({ text: (v as boolean).toString(), numeric: NaN }),
        config: {},
        values: [true, false, true],
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
    const typographyCtx = createTypographyContext(14, 'sans-serif');

    it('should return 0 when no header is present', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        return useHeaderHeight({
          fields,
          columnWidths: [],
          enabled: false,
          typographyCtx,
          sortColumns: [],
        });
      });
      expect(result.current).toBe(0);
    });

    it('should return the default height when wrap is disabled', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        return useHeaderHeight({
          fields,
          columnWidths: [],
          enabled: true,
          typographyCtx,
          sortColumns: [],
        });
      });
      expect(result.current).toBe(28);
    });

    it('should return the appropriate height for wrapped text', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
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
          typographyCtx: { ...typographyCtx, avgCharWidth: 5, measureHeight: jest.fn(() => 44) },
          sortColumns: [],
        });
      });

      expect(result.current).toBe(50);
    });

    it('should calculate the available width for a header cell based on the icons rendered within it', () => {
      const heightFn = jest.fn(() => 20);

      const { fields } = setupData();

      let modifiedFields = fields.map((field) => {
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
      });

      renderHook(() => {
        return useHeaderHeight({
          fields: modifiedFields,
          columnWidths: [100, 100, 100],
          enabled: true,
          typographyCtx: { ...typographyCtx, measureHeight: heightFn },
          sortColumns: [],
          showTypeIcons: false,
        });
      });

      expect(heightFn).toHaveBeenCalledWith('Longer name that needs wrapping', 86, modifiedFields[0], -1, 22);

      modifiedFields = fields.map((field) => {
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
      });

      renderHook(() => {
        return useHeaderHeight({
          fields: modifiedFields,
          columnWidths: [100, 100, 100],
          enabled: true,
          typographyCtx: { ...typographyCtx, measureHeight: heightFn },
          sortColumns: [{ columnKey: 'Longer name that needs wrapping', direction: 'ASC' }],
          showTypeIcons: true,
        });
      });

      expect(heightFn).toHaveBeenCalledWith('Longer name that needs wrapping', 26, modifiedFields[0], -1, 22);
    });

    it('does not throw if a field has been deleted but the colWidth has not yet been updated', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        return useHeaderHeight({
          fields,
          columnWidths: [100, 100, 100, 100],
          enabled: true,
          typographyCtx,
          sortColumns: [],
        });
      });
      expect(result.current).toBe(28);
    });
  });

  describe('useRowHeight', () => {
    const typographyCtx = createTypographyContext(14, 'sans-serif');

    it('returns the default height if there are no wrapped columns or nested frames', () => {
      const { fields } = setupData();

      const defaultHeight = 40;

      expect(
        renderHook(() => {
          return useRowHeight({
            fields,
            columnWidths: [100, 100, 100],
            defaultHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: false,
            expandedRows: new Set(),
          });
        }).result.current
      ).toBe(defaultHeight);
    });

    describe('nested frames', () => {
      it('returns 0 if the parent row is not expanded', () => {
        const { fields } = setupData();

        expect(
          renderHook(() => {
            const rowHeight = useRowHeight({
              fields: [
                { name: 'nested', type: FieldType.nestedFrames, values: [createDataFrame({ fields })], config: {} },
              ],
              columnWidths: [100, 100, 100],
              defaultHeight: 40,
              typographyCtx: typographyCtx,
              hasNestedFrames: true,
              expandedRows: new Set(),
            });
            if (typeof rowHeight !== 'function') {
              throw new Error('Expected rowHeight to be a function');
            }
            return rowHeight({ __depth: 1, data: createDataFrame({ fields }), __index: 0 });
          }).result.current
        ).toBe(0);
      });

      it('returns a static height if there are no rows in the nested frame', () => {
        const { fields } = setupData();

        expect(
          renderHook(() => {
            const rowHeight = useRowHeight({
              fields: [
                { name: 'nested', type: FieldType.nestedFrames, values: [createDataFrame({ fields })], config: {} },
              ],
              columnWidths: [100, 100, 100],
              defaultHeight: 40,
              typographyCtx: typographyCtx,
              hasNestedFrames: true,
              expandedRows: new Set([0]),
            });
            if (typeof rowHeight !== 'function') {
              throw new Error('Expected rowHeight to be a function');
            }
            return rowHeight({
              __depth: 1,
              data: undefined,
              __index: 0,
            });
          }).result.current
        ).toBe(TABLE.NESTED_NO_DATA_HEIGHT + TABLE.CELL_PADDING * 2);
      });

      it('calculates the height to return based on the number of rows in the nested frame', () => {
        const { fields } = setupData();

        const defaultHeight = 40;

        expect(
          renderHook(() => {
            const rowHeight = useRowHeight({
              fields: [
                { name: 'nested', type: FieldType.nestedFrames, values: [createDataFrame({ fields })], config: {} },
              ],
              columnWidths: [100, 100, 100],
              defaultHeight,
              typographyCtx: typographyCtx,
              hasNestedFrames: true,
              expandedRows: new Set([0]),
            });
            if (typeof rowHeight !== 'function') {
              throw new Error('Expected rowHeight to be a function');
            }
            return rowHeight({
              __index: 0,
              __depth: 1,
              data: createDataFrame({ fields }),
            });
          }).result.current
        ).toBe(defaultHeight * 4 + TABLE.CELL_PADDING * 2); // 3 rows + header + padding
      });

      it('removes the header if configured', () => {
        const { fields } = setupData();

        const defaultHeight = 40;

        expect(
          renderHook(() => {
            const rowHeight = useRowHeight({
              fields: [
                { name: 'nested', type: FieldType.nestedFrames, values: [createDataFrame({ fields })], config: {} },
              ],
              columnWidths: [100, 100, 100],
              defaultHeight,
              typographyCtx: typographyCtx,
              hasNestedFrames: true,
              expandedRows: new Set([0]),
            });
            if (typeof rowHeight !== 'function') {
              throw new Error('Expected rowHeight to be a function');
            }
            return rowHeight({
              __index: 0,
              __depth: 1,
              data: createDataFrame({ fields, meta: { custom: { noHeader: true } } }),
            });
          }).result.current
        ).toBe(defaultHeight * 3 + TABLE.CELL_PADDING * 2); // 3 rows + padding (no header)
      });
    });

    // we test the cell height measurerers and getRowHeight directly to check
    //that all of that  math is working correctly. we mainly want to confirm that
    // the cache is clearing and that the local logic in this hook works.
    describe('wrapped columns', () => {
      let rows: TableRow[];
      let fieldsWithWrappedText: Field[];

      beforeEach(() => {
        const { fields, rows: _rows } = setupData();

        rows = _rows;
        fieldsWithWrappedText = fields.map((field) => {
          if (field.name === 'name') {
            return {
              ...field,
              name: 'Longer name that needs wrapping',
              config: {
                ...field.config,
                custom: {
                  ...field.config?.custom,
                  cellOptions: {
                    cellType: TableCellDisplayMode.Auto,
                    wrapText: true,
                  },
                },
              },
            };
          }
          return field;
        });
      });

      it('handles changes to default height on re-render', () => {
        const { result, rerender } = renderHook(
          ({ defaultHeight }) => {
            const rowHeight = useRowHeight({
              fields: fieldsWithWrappedText,
              columnWidths: [100, 100, 100],
              defaultHeight,
              typographyCtx: typographyCtx,
              hasNestedFrames: false,
              expandedRows: new Set(),
            });
            if (typeof rowHeight !== 'function') {
              throw new Error('Expected rowHeight to be a function');
            }
            return rowHeight;
          },
          {
            initialProps: { defaultHeight: 40 },
          }
        );

        expect(result.current(rows[0])).toBe(40);

        // change the column widths
        rerender({ defaultHeight: 50 });

        expect(result.current(rows[0])).toBe(50);
      });

      it('adjusts the width of the columns based on the cell padding and border', () => {
        fieldsWithWrappedText[0].values[0] = 'Annie Lennox';

        const measureHeightFn = jest.fn(() => 40);
        const estimateHeightFn = jest.fn(() => 40);
        const { result } = renderHook(() => {
          const rowHeight = useRowHeight({
            fields: fieldsWithWrappedText,
            columnWidths: [100, 100, 100],
            defaultHeight: 40,
            typographyCtx: { ...typographyCtx, measureHeight: measureHeightFn, estimateHeight: estimateHeightFn },
            hasNestedFrames: false,
            expandedRows: new Set(),
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight;
        });

        expect(result.current(rows[0])).toEqual(expect.any(Number));

        expect(measureHeightFn).toHaveBeenCalledWith(
          'Annie Lennox',
          100 - TABLE.CELL_PADDING * 2 - TABLE.BORDER_RIGHT,
          fieldsWithWrappedText[0],
          0,
          22
        );
      });
    });
  });
});
