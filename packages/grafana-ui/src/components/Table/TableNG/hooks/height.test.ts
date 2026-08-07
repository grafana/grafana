import { renderHook } from '@testing-library/react';

import { createDataFrame, FieldType, type Field } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { TABLE } from '../constants';
import { type TableRow } from '../types';
import { createTypographyContext } from '../utils/height';
import { compileFrameToRecords } from '../utils/rows';

import { useHeaderHeight, useRowHeight } from './height';
import { emptyFilterResult, setupData } from './testHelpers';

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
    expect(result.current).toBe(TABLE.HEADER_HEIGHT);
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

    // colWidth 100 - chrome 13 - 3 icons (filter + sort + type) * 22 = 21, floor - 1 = 20.
    expect(heightFn).toHaveBeenCalledWith('Longer name that needs wrapping', 20, modifiedFields[0], -1, 22);
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
    expect(result.current).toBe(TABLE.HEADER_HEIGHT);
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
          defaultNestedHeight: defaultHeight,
          typographyCtx: typographyCtx,
          hasNestedFrames: false,
          nestedRows: [],
          nestedFields: [],
          nestedColWidths: [],
          visibleNestedRowCounts: [],
        });
      }).result.current
    ).toBe(defaultHeight);
  });

  describe('nested frames', () => {
    it('returns 0 if the parent row is not expanded', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const frameToRecords = compileFrameToRecords(
        frame.fields.map((f) => f.name),
        'nested'
      );
      const nestedRows = frameToRecords(frame);

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight: 40,
            defaultNestedHeight: 40,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [null],
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({ __depth: 1, data: frame, __index: 0 });
        }).result.current
      ).toBe(0);
    });

    it('returns a static height if there are no rows in the nested frame', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const frameToRecords = compileFrameToRecords(
        frame.fields.map((f) => f.name),
        'nested'
      );
      const nestedRows = frameToRecords(frame);

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight: 40,
            defaultNestedHeight: 40,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [0],
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

    it('includes nestedFooterHeight in expanded row height', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = frameToRecords(frame);
      const defaultHeight = 40;
      const nestedFooterHeight = 34; // equivalent to 1 reducer: LINE_HEIGHT + CELL_PADDING * 2

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight,
            defaultNestedHeight: defaultHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [3],
            nestedFooterHeight,
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({ __index: 0, __depth: 1, data: frame });
        }).result.current
        // 3 nested rows + header + footer + padding + scrollbar
      ).toBe(defaultHeight * 4 + TABLE.CELL_PADDING * 2 + TABLE.SCROLLBAR_AFFORDANCE + nestedFooterHeight);
    });

    it('includes nestedFooterHeight in the no-data expanded row height', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = frameToRecords(frame);
      const nestedFooterHeight = 34;

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight: 40,
            defaultNestedHeight: 40,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [0],
            nestedFooterHeight,
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({ __depth: 1, data: undefined, __index: 0 });
        }).result.current
      ).toBe(TABLE.NESTED_NO_DATA_HEIGHT + TABLE.CELL_PADDING * 2 + nestedFooterHeight);
    });

    it('calculates the height to return using default height', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = frameToRecords(frame);
      const defaultHeight = 40;

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight,
            defaultNestedHeight: defaultHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [3],
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({
            __index: 0,
            __depth: 1,
            data: frame,
          });
        }).result.current
      ).toBe(defaultHeight * 4 + TABLE.CELL_PADDING * 2 + TABLE.SCROLLBAR_AFFORDANCE); // 3 rows + header + padding + scrollbar
    });

    it('uses defaultNestedHeight (not defaultHeight) for the nested sub-table header', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = frameToRecords(frame);
      const defaultNonNestedHeight = 60;
      const defaultNestedHeight = 40;

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight: defaultNonNestedHeight,
            defaultNestedHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [3],
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({
            __index: 0,
            __depth: 1,
            data: frame,
          });
        }).result.current
        // 3 nested rows + nested header (uses defaultNestedHeight, not parent defaultHeight) + padding + scrollbar
      ).toBe(defaultNestedHeight * 4 + TABLE.CELL_PADDING * 2 + TABLE.SCROLLBAR_AFFORDANCE);
    });

    it('uses a string-based default height for the nested rows', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = frameToRecords(frame);

      expect(
        renderHook(() => {
          return useRowHeight({
            nestedData: [frame],
            fields: [
              { name: 'id', type: FieldType.string, values: ['1'], config: {} },
              { name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} },
            ],
            columnWidths: [100],
            defaultHeight: 40,
            defaultNestedHeight: 'min-content',
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
            visibleNestedRowCounts: [3],
          });
        }).result.current
      ).toBe('min-content');
    });

    it('removes the header if configured', () => {
      const { fields } = setupData();
      const frame = createDataFrame({ fields, meta: { custom: { noHeader: true } } });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRecords = frameToRecords(frame);
      const defaultHeight = 40;

      expect(
        renderHook(() => {
          const rowHeight = useRowHeight({
            nestedData: [frame],
            fields: [{ name: 'nested', type: FieldType.nestedFrames, values: [frame], config: {} }],
            columnWidths: [100, 100, 100],
            defaultHeight,
            defaultNestedHeight: defaultHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: true,
            visibleNestedRowCounts: [1],
            nestedRows: [
              {
                raw: nestedRecords,
                final: nestedRecords,
                filterResult: emptyFilterResult,
              },
            ],
            nestedFields: fields,
            nestedColWidths: [100, 100, 100],
          });
          if (typeof rowHeight !== 'function') {
            throw new Error('Expected rowHeight to be a function');
          }
          return rowHeight({
            __index: 0,
            __depth: 1,
            data: frame,
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
                wrapText: true,
                cellOptions: {
                  cellType: TableCellDisplayMode.Auto,
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
            defaultNestedHeight: defaultHeight,
            typographyCtx: typographyCtx,
            hasNestedFrames: false,
            visibleNestedRowCounts: [],
            nestedRows: [],
            nestedFields: [],
            nestedColWidths: [],
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
      const frame = createDataFrame({ fields: fieldsWithWrappedText });
      const fieldNames = frame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(fieldNames, 'nested');
      rows = frameToRecords(frame);

      const measureHeightFn = jest.fn(() => 40);
      const estimateHeightFn = jest.fn(() => 40);
      const { result } = renderHook(() => {
        const rowHeight = useRowHeight({
          fields: fieldsWithWrappedText,
          columnWidths: [100, 100, 100],
          defaultHeight: 40,
          defaultNestedHeight: 40,
          typographyCtx: { ...typographyCtx, measureHeight: measureHeightFn, estimateHeight: estimateHeightFn },
          hasNestedFrames: false,
          visibleNestedRowCounts: [],
          nestedRows: [],
          nestedFields: [],
          nestedColWidths: [],
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

    it('handles wrapped text in nested frames', () => {
      fieldsWithWrappedText[0].values[0] = 'Annie Lennox';
      const topFrame = createDataFrame({
        fields: [
          { name: 'foo', type: FieldType.string, values: ['1'] },
          {
            name: 'nested',
            type: FieldType.nestedFrames,
            values: [[createDataFrame({ fields: fieldsWithWrappedText })]],
          },
        ],
      });
      const topFrameFieldNames = topFrame.fields.map((f) => f.name);
      const frameToRecords = compileFrameToRecords(topFrameFieldNames, 'nested');
      rows = frameToRecords(topFrame);
      const nestedFrame = createDataFrame({ fields: fieldsWithWrappedText });
      const nestedFrameFieldNames = nestedFrame.fields.map((f) => f.name);
      const nestedFrameToRecords = compileFrameToRecords(nestedFrameFieldNames, 'nested');
      const nestedRows = nestedFrameToRecords(nestedFrame, 0);

      const measureHeightFn = jest.fn(() => 40);
      const estimateHeightFn = jest.fn(() => 40);
      const { result } = renderHook(() => {
        const rowHeight = useRowHeight({
          nestedData: [nestedFrame],
          fields: topFrame.fields,
          columnWidths: [330],
          defaultHeight: 40,
          defaultNestedHeight: 40,
          typographyCtx: { ...typographyCtx, measureHeight: measureHeightFn, estimateHeight: estimateHeightFn },
          hasNestedFrames: true,
          visibleNestedRowCounts: [3],
          nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
          nestedFields: fieldsWithWrappedText,
          nestedColWidths: [100, 100, 100],
        });
        if (typeof rowHeight !== 'function') {
          throw new Error('Expected rowHeight to be a function');
        }
        return rowHeight;
      });

      expect(result.current(nestedRows[0])).toEqual(expect.any(Number));

      expect(measureHeightFn).toHaveBeenCalledWith(
        'Annie Lennox',
        100 - TABLE.CELL_PADDING * 2 - TABLE.BORDER_RIGHT,
        fieldsWithWrappedText[0],
        0,
        22
      );
    });

    it('handles wrapped Time fields in nested frames (uses display-formatted value)', () => {
      const FORMATTED_TIME = '2024-03-26 14:30:00';
      const EPOCH_MS = 1711462200000;

      const nestedFieldsWithTime: Field[] = [
        {
          name: 'Time',
          type: FieldType.time,
          values: [EPOCH_MS, EPOCH_MS, EPOCH_MS],
          config: { custom: { wrapText: true } },
          display: jest.fn(() => ({ text: FORMATTED_TIME, numeric: EPOCH_MS, color: undefined, title: undefined })),
        },
      ];

      const topFrame = createDataFrame({
        fields: [
          { name: 'foo', type: FieldType.string, values: ['1'] },
          {
            name: 'nested',
            type: FieldType.nestedFrames,
            values: [[createDataFrame({ fields: nestedFieldsWithTime })]],
          },
        ],
      });
      const nestedFrame = createDataFrame({ fields: nestedFieldsWithTime });
      const fieldNames = nestedFrame.fields.map((f) => f.name);
      const nestedFrameToRecords = compileFrameToRecords(fieldNames, 'nested');
      const nestedRows = nestedFrameToRecords(nestedFrame, 0);

      const measureHeightFn = jest.fn(() => 40);
      const estimateHeightFn = jest.fn(() => 40);
      const { result } = renderHook(() => {
        const rowHeight = useRowHeight({
          nestedData: [nestedFrame],
          fields: topFrame.fields,
          columnWidths: [330],
          defaultHeight: 40,
          defaultNestedHeight: 40,
          typographyCtx: { ...typographyCtx, measureHeight: measureHeightFn, estimateHeight: estimateHeightFn },
          hasNestedFrames: true,
          visibleNestedRowCounts: [3],
          nestedRows: [{ raw: nestedRows, final: nestedRows, filterResult: emptyFilterResult }],
          nestedFields: nestedFieldsWithTime,
          nestedColWidths: [200],
        });
        if (typeof rowHeight !== 'function') {
          throw new Error('Expected rowHeight to be a function');
        }
        return rowHeight;
      });

      result.current(nestedRows[0]);

      // The measurer must receive the display-formatted string, not the raw epoch timestamp
      expect(measureHeightFn).toHaveBeenCalledWith(
        FORMATTED_TIME,
        200 - TABLE.CELL_PADDING * 2 - TABLE.BORDER_RIGHT,
        nestedFieldsWithTime[0],
        0,
        22
      );
    });

    it('uses a string-based default height when set', () => {
      const { fields } = setupData();
      const { result } = renderHook(() => {
        return useRowHeight({
          fields,
          columnWidths: [100, 100, 100],
          defaultHeight: 'min-content',
          defaultNestedHeight: 40,
          typographyCtx: typographyCtx,
          hasNestedFrames: false,
          visibleNestedRowCounts: [],
          nestedRows: [],
          nestedFields: [],
          nestedColWidths: [],
        });
      });
      expect(result.current).toBe('min-content');
    });
  });
});
