import { SortColumn } from 'react-data-grid';

import {
  createDataFrame,
  createTheme,
  DataFrame,
  DisplayProcessor,
  DisplayValue,
  Field,
  FieldType,
  GrafanaTheme2,
  LinkModel,
  ValueLinkConfig,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  TableCellHeight,
} from '@grafana/schema';

import { Trans } from '../../../utils/i18n';
import { PanelContext } from '../../PanelChrome';

import { mapFrameToDataGrid, myRowRenderer } from './TableNG';
import { COLUMN, TABLE } from './constants';
import { TableColumn } from './types';
import {
  convertRGBAToHex,
  extractPixelValue,
  frameToRecords,
  getAlignmentFactor,
  getCellColors,
  getCellLinks,
  getCellOptions,
  getComparator,
  getDefaultRowHeight,
  getFooterItemNG,
  getFooterStyles,
  getIsNestedTable,
  getTextAlign,
  handleSort,
  isTextCell,
  migrateTableDisplayModeToCellOptions,
} from './utils';

const data = createDataFrame({
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      values: [],
      config: {
        custom: {
          width: undefined, // For width distribution testing
          displayMode: 'auto',
        },
      },
    },
    {
      name: 'Value',
      type: FieldType.number,
      values: [],
      display: ((v: unknown) => ({
        text: String(v),
        numeric: v,
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      })) as DisplayProcessor,
      config: {
        custom: {
          width: 100,
          displayMode: 'basic',
        },
      },
    },
    {
      name: 'Message',
      type: FieldType.string,
      values: [],
      config: {
        custom: {
          align: 'center',
        },
      },
    },
  ],
  meta: {
    custom: {
      noHeader: false, // For header rendering tests
    },
  },
});

const calcsRef = { current: [] };
const headerCellRefs = { current: {} };
const crossFilterOrder = { current: [] };
const crossFilterRows = { current: {} };
const sortColumnsRef = { current: [] };

const mockOptions = {
  ctx: null as unknown as CanvasRenderingContext2D,
  textWraps: {},
  rows: [],
  sortedRows: [],
  setContextMenuProps: () => {},
  setFilter: () => {},
  setIsInspecting: () => {},
  data,
  width: 800,
  height: 600,
  fieldConfig: {
    defaults: {
      custom: {
        width: 'auto',
        minWidth: COLUMN.MIN_WIDTH,
        cellOptions: {
          wrapText: false,
        },
      },
    },
    overrides: [
      {
        matcher: { id: 'byName', options: 'Value' },
        properties: [{ id: 'width', value: 100 }],
      },
    ],
  },
  columnTypes: {},
  columnWidth: 'auto',
  defaultLineHeight: 40,
  defaultRowHeight: 40,
  expandedRows: [],
  filter: {},
  headerCellRefs,
  crossFilterOrder,
  crossFilterRows,
  isCountRowsSet: false,
  styles: { cell: '', cellWrapped: '', dataGrid: '' },
  theme: createTheme(),
  setSortColumns: () => {},
  sortColumnsRef,
  textWrap: false,
};

describe('TableNG utils', () => {
  describe('mapFrameToDataGrid', () => {
    it('take data frame and return array of columns', () => {
      const columns = mapFrameToDataGrid({
        frame: data,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // Test column structure
      expect(columns).toHaveLength(3);

      // Test Time column
      expect(columns[0]).toMatchObject({
        key: 'Time',
        name: 'Time',
        field: expect.objectContaining({
          name: 'Time',
          type: FieldType.time,
        }),
      });

      // Test Value column with custom width
      expect(columns[1]).toMatchObject({
        key: 'Value',
        name: 'Value',
        // TODO: fix this
        // width: 100,
        field: expect.objectContaining({
          name: 'Value',
          type: FieldType.number,
        }),
      });

      // Test Message column alignment
      expect(columns[2]).toMatchObject({
        key: 'Message',
        name: 'Message',
        field: expect.objectContaining({
          name: 'Message',
          type: FieldType.string,
          config: expect.objectContaining({
            custom: expect.objectContaining({
              align: 'center',
            }),
          }),
        }),
      });
    });
  });

  describe('column building', () => {
    it('should build basic column structure', () => {
      const columns = mapFrameToDataGrid({
        frame: data,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      expect(columns).toHaveLength(3);
      columns.forEach((column: TableColumn) => {
        expect(column).toHaveProperty('key');
        expect(column).toHaveProperty('name');
        expect(column).toHaveProperty('field');
        expect(column).toHaveProperty('cellClass');
        expect(column).toHaveProperty('renderCell');
        expect(column).toHaveProperty('renderHeaderCell');
      });
    });

    it.skip('should handle column width configurations', () => {
      const columns = mapFrameToDataGrid({
        frame: data,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // Default width
      expect(columns[0].width).toBe(350);
      // Explicit width from field config
      expect(columns[1].width).toBe(100);
      // Default width with min width
      expect(columns[2].minWidth).toBe(COLUMN.MIN_WIDTH);
    });

    it('should handle cell alignment', () => {
      const columns = mapFrameToDataGrid({
        frame: data,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      const messageColumn = columns[2];
      expect(messageColumn.field.config.custom.align).toBe('center');
    });

    it('should handle footer/summary rows', () => {
      const options = {
        ...mockOptions,
        isCountRowsSet: true,
      };

      const columns = mapFrameToDataGrid({
        frame: data,
        calcsRef: { current: ['3', '', ''] },
        options,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // First column should show count
      const firstCell = columns[0].renderSummaryCell?.({
        row: { __depth: 0, __index: 0 },
        column: {
          ...columns[0],
          frozen: false,
          idx: 0,
          parent: undefined,
          level: 0,
          sortable: true,
          minWidth: 100,
          draggable: true,
          renderCell: () => null,
          renderHeaderCell: () => null,
          resizable: true,
          width: 100,
          maxWidth: undefined,
          headerCellClass: undefined,
          summaryCellClass: undefined,
        },
        tabIndex: 0,
      });

      expect(firstCell).toBeDefined();

      // Check the div structure and content
      const divElement = firstCell as JSX.Element;
      expect(divElement.props.style).toEqual({ display: 'flex', justifyContent: 'space-between' });

      // Check that we have two spans with correct content
      const [countSpan, valueSpan] = divElement.props.children;
      expect(countSpan.type).toBe('span');
      expect(countSpan.props.children.type).toBe(Trans);
      expect(countSpan.props.children.props.i18nKey).toBe('grafana-ui.table.count');
      expect(valueSpan.props.children).toBe('3');
    });
  });

  describe('nested frames', () => {
    const nestedData = createDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2] },
        { name: 'Value', type: FieldType.number, values: [10, 20] },
        {
          name: 'Nested frames',
          type: FieldType.nestedFrames,
          values: [
            [
              createDataFrame({
                fields: [
                  { name: 'Nested Time', type: FieldType.time, values: [3] },
                  { name: 'Nested Value', type: FieldType.number, values: [30] },
                ],
              }),
            ],
          ],
        },
      ],
    });

    it('should add expander column for nested frames', () => {
      const columns = mapFrameToDataGrid({
        frame: nestedData,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // First column should be expander
      expect(columns[0]).toMatchObject({
        key: 'expanded',
        name: '',
        width: COLUMN.EXPANDER_WIDTH,
        minWidth: COLUMN.EXPANDER_WIDTH,
      });
    });

    it('should not render nested frame type fields', () => {
      const columns = mapFrameToDataGrid({
        frame: nestedData,
        calcsRef,
        options: mockOptions,
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // Should only have expander + Time + Value (not Nested frames column)
      expect(columns).toHaveLength(3);

      // No column should be of type nestedFrames
      const hasNestedFrameColumn = columns.some((col: TableColumn) => col.field.type === FieldType.nestedFrames);
      expect(hasNestedFrameColumn).toBe(false);
    });

    it('should render nested frame data when expanded', () => {
      const expandedRows = [0];
      const columns = mapFrameToDataGrid({
        frame: nestedData,
        calcsRef,
        options: { ...mockOptions, expandedRows },
        handlers: { onCellExpand: () => {}, onColumnResize: () => {} },
        availableWidth: mockOptions.width,
      });

      // Get the rendered content of first row's expander cell
      const expanderCell = columns[0].renderCell?.({
        row: {
          __depth: 1,
          __index: 0,
          data: nestedData.fields[2].values[0][0],
        },
        rowIdx: 0,
        column: {
          ...columns[0],
          frozen: false,
          idx: 0,
          parent: undefined,
          level: 0,
          sortable: true,
          minWidth: 100,
          draggable: true,
          renderCell: () => null,
          renderHeaderCell: () => null,
          resizable: true,
          width: 100,
          maxWidth: undefined,
          headerCellClass: undefined,
          summaryCellClass: undefined,
        },
        isCellEditable: false,
        tabIndex: 0,
        onRowChange: () => {},
      });

      expect(expanderCell).toBeDefined();
    });
  });

  describe('getFooterItemNG', () => {
    const rows = [
      { Field1: 1, Text: 'a', __depth: 0, __index: 0 },
      { Field1: 2, Text: 'b', __depth: 0, __index: 1 },
      { Field1: 3, Text: 'c', __depth: 0, __index: 2 },
      { Field2: 3, Text: 'd', __depth: 0, __index: 3 },
      { Field2: 10, Text: 'e', __depth: 0, __index: 4 },
    ];

    const numericField: Field = {
      name: 'Field1',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {
        custom: {},
      },
      display: (value: unknown) => ({
        text: String(value),
        numeric: Number(value),
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      }),
      state: {},
      getLinks: undefined,
    };

    const numericField2: Field = {
      name: 'Field2',
      type: FieldType.number,
      values: [3, 10],
      config: { custom: {} },
      display: (value: unknown) => ({
        text: String(value),
        numeric: Number(value),
        color: undefined,
        prefix: undefined,
        suffix: undefined,
      }),
      state: {},
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
      state: {},
      getLinks: undefined,
    };

    it('should calculate sum for numeric fields', () => {
      const result = getFooterItemNG(rows, numericField, {
        show: true,
        reducer: ['sum'],
      });

      expect(result).toBe('6'); // 1 + 2 + 3
    });

    it('should calculate mean for numeric fields', () => {
      const result = getFooterItemNG(rows, numericField, {
        show: true,
        reducer: ['mean'],
      });

      expect(result).toBe('2'); // (1 + 2 + 3) / 3
    });

    it('should return empty string for non-numeric fields', () => {
      const result = getFooterItemNG(rows, textField, {
        show: true,
        reducer: ['sum'],
      });

      expect(result).toBe('');
    });

    it('should return empty string when footer not shown', () => {
      const result = getFooterItemNG(rows, numericField, undefined);

      expect(result).toBe('');
    });

    it('should return empty string when reducer is undefined', () => {
      const result = getFooterItemNG(rows, numericField, {
        show: true,
        reducer: undefined,
      });
      expect(result).toBe('');
    });

    it('should correctly calculate sum for numeric fields based on selected fields', () => {
      const numericField1Result = getFooterItemNG(rows, numericField, {
        show: true,
        reducer: ['sum'],
        fields: ['Field1'],
      });

      const numericField2Result = getFooterItemNG(rows, numericField2, {
        show: true,
        reducer: ['sum'],
        fields: ['Field2'],
      });

      expect(numericField1Result).toBe('6'); // 1 + 2 + 3
      expect(numericField2Result).toBe('13'); // 3 + 10
    });
  });

  describe('text alignment', () => {
    it('should map alignment options to flex values', () => {
      // Test 'left' alignment
      const leftField = {
        name: 'Value',
        type: FieldType.string,
        values: [],
        config: {
          custom: {
            align: 'left',
          },
        },
      };
      expect(getTextAlign(leftField)).toBe('flex-start');

      // Test 'center' alignment
      const centerField = {
        name: 'Value',
        type: FieldType.string,
        values: [],
        config: {
          custom: {
            align: 'center',
          },
        },
      };
      expect(getTextAlign(centerField)).toBe('center');

      // Test 'right' alignment
      const rightField = {
        name: 'Value',
        type: FieldType.string,
        values: [],
        config: {
          custom: {
            align: 'right',
          },
        },
      };
      expect(getTextAlign(rightField)).toBe('flex-end');
    });

    it('should default to flex-start when no alignment specified', () => {
      const field = {
        name: 'Value',
        type: FieldType.string,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-start');
    });

    it('should default to flex-start when no field is specified', () => {
      expect(getTextAlign(undefined)).toBe('flex-start');
    });

    it('should default to flex-end for number types', () => {
      const field = {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-end');
    });

    it('should default to flex-start for string types', () => {
      const field = {
        name: 'String',
        type: FieldType.string,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-start');
    });

    it('should default to flex-start for enum types', () => {
      const field = {
        name: 'Enum',
        type: FieldType.enum,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-start');
    });

    it('should default to flex-start for time types', () => {
      const field = {
        name: 'Time',
        type: FieldType.time,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-start');
    });

    it('should default to flex-start for boolean types', () => {
      const field = {
        name: 'Active',
        type: FieldType.boolean,
        values: [],
        config: {
          custom: {},
        },
      };
      expect(getTextAlign(field)).toBe('flex-start');
    });
  });

  describe('cell display mode', () => {
    const theme = {
      colors: {
        isDark: true,
        mode: 'dark',
        primary: {
          text: '#FFFFFF',
          main: '#FF0000',
        },
        background: {
          canvas: '#000000',
          primary: '#111111',
        },
        text: {
          primary: '#FFFFFF',
        },
        action: {
          hover: '#FF0000',
        },
      },
    } as unknown as GrafanaTheme2;

    it('should handle color background mode', () => {
      const field = {
        type: TableCellDisplayMode.ColorBackground as const,
        mode: TableCellBackgroundDisplayMode.Basic,
      };

      const displayValue = {
        text: '100',
        numeric: 100,
        color: '#ff0000',
      };

      const colors = getCellColors(theme, field, displayValue);
      expect(colors.bgColor).toBe('rgb(255, 0, 0)');
      expect(colors.textColor).toBe('rgb(247, 248, 250)');
      expect(colors.bgHoverColor).toBe('rgb(255, 36, 36)');
    });

    it('should handle color background gradient mode', () => {
      const field = {
        type: TableCellDisplayMode.ColorBackground as const,
        mode: TableCellBackgroundDisplayMode.Gradient,
      };

      const displayValue = {
        text: '100',
        numeric: 100,
        color: '#ff0000',
      };

      const colors = getCellColors(theme, field, displayValue);
      expect(colors.bgColor).toBe('linear-gradient(120deg, rgb(255, 54, 36), #ff0000)');
      expect(colors.textColor).toBe('rgb(247, 248, 250)');
      expect(colors.bgHoverColor).toBe('linear-gradient(120deg, rgb(255, 54, 36), rgb(255, 54, 54))');
    });
  });

  describe('frame to records conversion', () => {
    it('should convert DataFrame to TableRows', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'time', values: [1, 2] },
          { name: 'value', values: [10, 20] },
        ],
      });

      const records = frameToRecords(frame);
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        __depth: 0,
        __index: 0,
        time: 1,
        value: 10,
      });
    });
  });

  describe('handleSort', () => {
    const setSortColumns = jest.fn();
    const sortColumnsRef: { current: SortColumn[] } = { current: [] };

    beforeEach(() => {
      setSortColumns.mockClear();
      sortColumnsRef.current = [];
    });

    it('should set initial sort', () => {
      handleSort('Value', 'ASC', false, setSortColumns, sortColumnsRef);

      expect(setSortColumns).toHaveBeenCalledWith([{ columnKey: 'Value', direction: 'ASC' }]);
    });

    it('should toggle sort direction on same column', () => {
      // Initial sort
      sortColumnsRef.current = [{ columnKey: 'Value', direction: 'ASC' }] as const;

      handleSort('Value', 'DESC', false, setSortColumns, sortColumnsRef);

      expect(setSortColumns).toHaveBeenCalledWith([{ columnKey: 'Value', direction: 'DESC' }]);
    });

    it('should handle multi-sort with shift key', () => {
      // Initial sort
      sortColumnsRef.current = [{ columnKey: 'Time', direction: 'ASC' }] as const;

      handleSort('Value', 'ASC', true, setSortColumns, sortColumnsRef);

      expect(setSortColumns).toHaveBeenCalledWith([
        { columnKey: 'Time', direction: 'ASC' },
        { columnKey: 'Value', direction: 'ASC' },
      ]);
    });

    it('should remove sort when toggling through all states', () => {
      // Initial ASC sort
      sortColumnsRef.current = [{ columnKey: 'Value', direction: 'ASC' }] as const;

      // Toggle to DESC
      handleSort('Value', 'DESC', false, setSortColumns, sortColumnsRef);
      expect(setSortColumns).toHaveBeenCalledWith([{ columnKey: 'Value', direction: 'DESC' }]);

      // Toggle to no sort
      handleSort('Value', 'DESC', false, setSortColumns, sortColumnsRef);
      expect(setSortColumns).toHaveBeenCalledWith([]);
    });
  });

  describe('getAlignmentFactor', () => {
    it('should create a new alignment factor when none exists', () => {
      // Create a field with no existing alignment factor
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        // No state property initially
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
        }),
      };

      // Create a display value
      const displayValue: DisplayValue = {
        text: '1',
        numeric: 1,
      };

      // Call getAlignmentFactor with the first row
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result has the text property
      expect(result).toEqual(
        expect.objectContaining({
          text: '1',
        })
      );

      // Verify that field.state was created and contains the alignment factor
      expect(field.state).toBeDefined();
      expect(field.state?.alignmentFactors).toBeDefined();
      expect(field.state?.alignmentFactors).toEqual(
        expect.objectContaining({
          text: '1',
        })
      );
    });

    it('should update alignment factor when a longer value is found', () => {
      // Create a field with an existing alignment factor
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        state: {
          alignmentFactors: {
            text: '1',
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
        }),
      };

      // Create a display value that is longer than the existing alignment factor
      const displayValue: DisplayValue = {
        text: '4444',
        numeric: 4444,
      };

      // Call getAlignmentFactor
      const result = getAlignmentFactor(field, displayValue, 3);

      // Verify the result is updated to the longer value
      expect(result).toEqual(
        expect.objectContaining({
          text: '4444',
        })
      );

      // Verify that field.state.alignmentFactors was updated
      expect(field.state?.alignmentFactors).toEqual(
        expect.objectContaining({
          text: '4444',
        })
      );
    });

    it('should not update alignment factor when a shorter value is found', () => {
      // Create a field with an existing alignment factor for a long value
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        state: {
          alignmentFactors: {
            text: '4444',
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
        }),
      };

      // Create a display value that is shorter than the existing alignment factor
      const displayValue: DisplayValue = {
        text: '1',
        numeric: 1,
      };

      // Call getAlignmentFactor
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result is still the longer value
      expect(result).toEqual(
        expect.objectContaining({
          text: '4444',
        })
      );

      // Verify that field.state.alignmentFactors was not changed
      expect(field.state?.alignmentFactors).toEqual(
        expect.objectContaining({
          text: '4444',
        })
      );
    });

    it('should add alignment factor to existing field state', () => {
      // Create a field with existing state but no alignment factors yet
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        // Field has state but no alignmentFactors
        state: {
          // Use a valid property for FieldState
          // For example, if calcs is a valid property:
          calcs: { sum: 4460 },
          // Or if noValue is a valid property:
          // noValue: true
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
        }),
      };

      // Create a display value
      const displayValue: DisplayValue = {
        text: '1',
        numeric: 1,
      };

      // Call getAlignmentFactor with the first row
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result has the text property
      expect(result).toEqual(
        expect.objectContaining({
          text: '1',
        })
      );

      // Verify that field.state was preserved and alignment factor was added
      expect(field.state).toBeDefined();
      // Check for the valid property we used
      expect(field.state?.calcs).toBeDefined();
      expect(field.state?.alignmentFactors).toBeDefined();
      expect(field.state?.alignmentFactors).toEqual(
        expect.objectContaining({
          text: '1',
        })
      );
    });
  });

  describe('getIsNestedTable', () => {
    it('should detect nested frames', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          { type: FieldType.nestedFrames, name: 'nestedCol', config: {}, values: [] },
        ],
        length: 0,
        name: 'test',
      };
      expect(getIsNestedTable(frame)).toBe(true);
    });

    it('should return false for regular frames', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          { type: FieldType.number, name: 'numberCol', config: {}, values: [] },
        ],
        length: 0,
        name: 'test',
      };
      expect(getIsNestedTable(frame)).toBe(false);
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
  });

  /*
  describe('shouldTextOverflow', () => {
    const mockContext = {
      font: '',
      measureText: (text: string) => ({
        // Each character is 8px wide in our mock context
        width: text.length * 8,
      }),
    };
    const ctx = mockContext as unknown as CanvasRenderingContext2D;

    const headerCellRefs = {
      current: {
        column1: {
          getBoundingClientRect: () => ({ width: 100 }),
          offsetWidth: 100,
        },
      } as unknown as Record<string, HTMLDivElement>,
    };

    it('should return true when text exceeds cell width', () => {
      const row = {
        __depth: 0,
        __index: 0,
        // 43*8 = 344px wide cell, it should overflow as it's greater than 100px
        column1: 'This is a very long text that should overflow',
      };
      const columnTypes = { column1: FieldType.string };

      const result = shouldTextOverflow(
        'column1',
        row,
        columnTypes,
        headerCellRefs,
        ctx,
        20, // lineHeight
        40, // defaultRowHeight
        8, // padding
        false, // textWrap
        {
          config: {
            custom: {
              inspect: false,
            },
          },
        } as Field,
        TableCellDisplayMode.Auto // cellType
      );

      expect(result).toBe(true);
    });

    it('should return false when text fits cell width', () => {
      const row = {
        __depth: 0,
        __index: 0,
        // 9*8 = 72px wide cell, it should fit as it's less than 100px
        column1: 'Short text',
      };
      const columnTypes = { column1: FieldType.string };

      const result = shouldTextOverflow(
        'column1',
        row,
        columnTypes,
        headerCellRefs,
        ctx,
        20, // lineHeight
        40, // defaultRowHeight
        8, // padding
        false, // textWrap
        {
          config: {
            custom: {
              inspect: false,
            },
          },
        } as Field,
        TableCellDisplayMode.Auto // cellType
      );

      expect(result).toBe(false);
    });

    it('should return false when text wrapping is enabled', () => {
      const row = {
        __depth: 0,
        __index: 0,
        column1: 'This is a very long text that should wrap instead of overflow',
      };
      const columnTypes = { column1: FieldType.string };

      const result = shouldTextOverflow(
        'column1',
        row,
        columnTypes,
        headerCellRefs,
        ctx,
        20, // lineHeight
        40, // defaultRowHeight
        8, // padding
        true, // textWrap ENABLED
        {
          config: {
            custom: {
              inspect: true,
            },
          },
        } as Field,
        TableCellDisplayMode.Auto // cellType
      );

      expect(result).toBe(false);
    });

    it('should return false when cell inspection is enabled', () => {
      const row = {
        __depth: 0,
        __index: 0,
        column1: 'This is a very long text',
      };
      const columnTypes = { column1: FieldType.string };

      const result = shouldTextOverflow(
        'column1',
        row,
        columnTypes,
        headerCellRefs,
        ctx,
        20, // lineHeight
        40, // defaultRowHeight
        8, // padding
        false, // textWrap
        {
          config: {
            custom: {
              inspect: true,
            },
          },
        } as Field,
        TableCellDisplayMode.Auto // cellType
      );

      expect(result).toBe(false);
    });
  });

  describe.skip('getRowHeight', () => {
    const ctx = {
      font: '14px Inter, sans-serif',
      letterSpacing: '0.15px',
      measureText: (text: string) => ({
        width: text.length * 8,
      }),
    } as unknown as CanvasRenderingContext2D;

    const calc = uWrap(ctx);

    const headerCellRefs = {
      current: {
        stringCol: { offsetWidth: 100 },
        numberCol: { offsetWidth: 100 },
      } as unknown as Record<string, HTMLDivElement>,
    };

    it('should return default height when no text cells present', () => {
      const row = {
        __depth: 0,
        __index: 0,
        numberCol: 123,
      };
      const columnTypes = { numberCol: FieldType.number };

      const height = getRowHeight(
        row,
        calc,
        8,
        headerCellRefs,
        20, // lineHeight
        40, // defaultRowHeight
        8 // padding
      );

      expect(height).toBe(40);
    });

    it('should calculate height based on longest text cell', () => {
      const row = {
        __depth: 0,
        __index: 0,
        stringCol: 'This is a very long text that should wrap',
        numberCol: 123,
      };
      const columnTypes = {
        stringCol: FieldType.string,
        numberCol: FieldType.number,
      };

      const height = getRowHeight(row, columnTypes, headerCellRefs, ctx, 20, 40, 8);

      expect(height).toBeGreaterThan(40);
      expect(height).toBe(112);
    });

    it('should handle empty header cell refs', () => {
      const row = {
        __depth: 0,
        __index: 0,
        stringCol: 'Some text',
      };
      const columnTypes = { stringCol: FieldType.string };
      const emptyRefs = { current: {} } as unknown as React.MutableRefObject<Record<string, HTMLDivElement>>;

      const height = getRowHeight(row, columnTypes, emptyRefs, ctx, 20, 40, 8);

      expect(height).toBe(40);
    });
  });
*/

  describe('isTextCell', () => {
    it('should return true for string fields', () => {
      expect(isTextCell('column', { column: FieldType.string })).toBe(true);
    });

    it('should return false for non-string fields', () => {
      expect(isTextCell('column', { column: FieldType.number })).toBe(false);
      expect(isTextCell('column', { column: FieldType.time })).toBe(false);
      expect(isTextCell('column', { column: FieldType.boolean })).toBe(false);
    });

    it('should handle unknown fields', () => {
      expect(isTextCell('unknown', { column: FieldType.string })).toBe(false);
    });
  });

  describe('migrateTableDisplayModeToCellOptions', () => {
    it('should migrate basic to gauge mode', () => {
      const result = migrateTableDisplayModeToCellOptions(TableCellDisplayMode.BasicGauge);
      expect(result).toEqual({
        type: TableCellDisplayMode.Gauge,
        mode: BarGaugeDisplayMode.Basic,
      });
    });

    it('should migrate gradient-gauge to gauge mode with gradient', () => {
      const result = migrateTableDisplayModeToCellOptions(TableCellDisplayMode.GradientGauge);
      expect(result).toEqual({
        type: TableCellDisplayMode.Gauge,
        mode: BarGaugeDisplayMode.Gradient,
      });
    });

    it('should migrate color-background to color background with gradient', () => {
      const result = migrateTableDisplayModeToCellOptions(TableCellDisplayMode.ColorBackground);
      expect(result).toEqual({
        type: TableCellDisplayMode.ColorBackground,
        mode: TableCellBackgroundDisplayMode.Gradient,
      });
    });

    it('should handle other display modes', () => {
      const result = migrateTableDisplayModeToCellOptions(TableCellDisplayMode.ColorText);
      expect(result).toEqual({
        type: TableCellDisplayMode.ColorText,
      });
    });
  });

  describe('getCellOptions', () => {
    it('should return default options when no custom config is provided', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: [],
      };

      const options = getCellOptions(field);

      // Check that default options are returned
      expect(options).toEqual({ type: TableCellDisplayMode.Auto });
    });

    it('should extract cell options from field config', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: {
            cellOptions: {
              type: TableCellDisplayMode.ColorText,
              inspectEnabled: false,
              wrapText: true,
            },
          },
        },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options).toEqual({
        type: TableCellDisplayMode.ColorText,
        inspectEnabled: false,
        wrapText: true,
      });
    });

    it('should handle legacy displayMode property', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: {
            displayMode: 'color-background',
          },
        },
        values: [],
      };

      const options = getCellOptions(field);

      // The legacy displayMode should be converted to the new format
      expect(options.type).toBe(TableCellDisplayMode.ColorBackground);
    });

    it('should prioritize cellOptions over legacy displayMode', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: {
            displayMode: 'color-background',
            cellOptions: {
              type: TableCellDisplayMode.ColorText,
            },
          },
        },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options.type).toBe(TableCellDisplayMode.ColorBackground);
    });

    it('should handle image display mode', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: {
            cellOptions: {
              type: TableCellDisplayMode.Image,
              // Add image-specific options if they exist
            },
          },
        },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options.type).toBe(TableCellDisplayMode.Image);
    });

    it('should handle JSON display mode', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: {
            cellOptions: {
              type: TableCellDisplayMode.JSONView,
            },
          },
        },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options.type).toBe(TableCellDisplayMode.JSONView);
    });
  });

  describe('getCellLinks', () => {
    it('should return undefined when field has no getLinks function', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value'],
      };

      const links = getCellLinks(field, 0);
      expect(links).toEqual(undefined);
    });

    it('should return links from field getLinks function', () => {
      const mockLinks: LinkModel[] = [
        { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
        { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
      ];

      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1', 'value2'],
        getLinks: (config: ValueLinkConfig) => {
          return config.valueRowIndex === 0 ? mockLinks : [];
        },
      };

      const links = getCellLinks(field, 0);
      expect(links).toEqual(mockLinks);
    });

    it('should return empty array for out of bounds index', () => {
      const mockLinks: LinkModel[] = [
        { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
      ];

      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: (config: ValueLinkConfig) => {
          return config.valueRowIndex === 0 ? mockLinks : [];
        },
      };

      // Index out of bounds
      const links = getCellLinks(field, 1);
      expect(links).toEqual([]);
    });

    it('should handle getLinks returning undefined', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: (config: ValueLinkConfig) => {
          return [];
        },
      };

      const links = getCellLinks(field, 0);
      expect(links).toEqual([]);
    });

    it('should handle different link configurations', () => {
      // Create links with different valid configurations
      const mockLinks: LinkModel[] = [
        // Standard link with href
        {
          title: 'External Link',
          href: 'http://example.com/full',
          target: '_blank',
          origin: { datasourceUid: 'test' },
        },
        // Internal link with onClick handler
        {
          title: 'Internal Link',
          href: '', // Empty href for internal links
          onClick: jest.fn(),
          target: '_self',
          origin: { datasourceUid: 'test' },
        },
      ];

      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: () => mockLinks,
      };

      const links = getCellLinks(field, 0);

      // Verify links are returned unmodified
      expect(links).toEqual(mockLinks);

      // Verify we have both types of links
      expect(links?.find((link) => link.onClick !== undefined)).toBeDefined();
      expect(links?.find((link) => link.href === 'http://example.com/full')).toBeDefined();
    });
  });

  /*
  describe.skip('getCellHeight', () => {
    // Create a mock CanvasRenderingContext2D
    const createMockContext = () => {
      return {
        measureText: jest.fn((text) => {
          // Simple mock that returns width based on text length
          // This is a simplification - real browser would be more complex
          return { width: text.length * 8 }; // Assume 8px per character
        }),
      } as unknown as CanvasRenderingContext2D;
    };

    it('should return default row height when ctx is null', () => {
      const defaultRowHeight = 40;
      const height = getCellHeight('Some text', 100, null, 20, defaultRowHeight);
      expect(height).toBe(defaultRowHeight);
    });

    it('should return default row height for text that fits in one line', () => {
      const mockContext = createMockContext();
      const defaultRowHeight = 40;
      const cellWidth = 100; // 100px width
      const text = 'Short'; // 5 chars * 8px = 40px, fits in cellWidth

      const height = getCellHeight(text, cellWidth, mockContext, 20, defaultRowHeight);

      // Since text fits in one line, should return default height
      expect(height).toBe(defaultRowHeight);
      expect(mockContext.measureText).toHaveBeenCalled();
    });

    it('should calculate height for text that wraps to multiple lines', () => {
      const mockContext = createMockContext();
      const defaultRowHeight = 40;
      const lineHeight = 20;
      const cellWidth = 100; // 100px width
      // This text is long enough to wrap to multiple lines
      const text = 'This is a very long text that will definitely need to wrap to multiple lines in our table cell';

      const height = getCellHeight(text, cellWidth, mockContext, lineHeight, defaultRowHeight);

      // Should be greater than default height since text wraps
      expect(height).toBeGreaterThan(defaultRowHeight);
      expect(height).toBe(180);
      // Height should be a multiple of line height plus padding
      expect(height % lineHeight).toBe(0);
      expect(mockContext.measureText).toHaveBeenCalled();
    });

    it('should account for padding when calculating height', () => {
      const mockContext = createMockContext();
      const defaultRowHeight = 40;
      const lineHeight = 20;
      const cellWidth = 100;
      const padding = 10;
      const text = 'This is a very long text that will wrap to multiple lines';

      const heightWithoutPadding = getCellHeight(text, cellWidth, mockContext, lineHeight, defaultRowHeight);
      const heightWithPadding = getCellHeight(text, cellWidth, mockContext, lineHeight, defaultRowHeight, padding);

      // Height with padding should be greater than without padding
      expect(heightWithPadding).toBeGreaterThan(heightWithoutPadding);
      // The difference should be related to the padding (padding is applied twice in the function)
      expect(heightWithPadding - heightWithoutPadding).toBe(padding * 2 * 2);
    });

    it('should handle empty text', () => {
      const mockContext = createMockContext();
      const defaultRowHeight = 40;

      const height = getCellHeight('', 100, mockContext, 20, defaultRowHeight);

      // Empty text should return default height
      expect(height).toBe(defaultRowHeight);
    });
  });
*/

  describe('getFooterStyles', () => {
    it('should create an emotion css class', () => {
      const styles = getFooterStyles('flex-start');

      // Check that the footerCell style has been created
      expect(styles.footerCell).toBeDefined();

      // Get the CSS string representation
      const cssString = styles.footerCell.toString();

      // Verify it's an Emotion CSS class
      expect(cssString).toContain('css-');
    });

    it('should use the provided justification value', () => {
      const styles = getFooterStyles('center');

      // Create a DOM element and apply the CSS class
      document.body.innerHTML = `<div class="${styles.footerCell}">Test</div>`;
      const element = document.querySelector('div');

      // Get the computed style
      const computedStyle = window.getComputedStyle(element!);

      // Check the CSS property
      expect(computedStyle.justifyContent).toBe('center');
    });

    it('should default to space-between when no justification is provided', () => {
      const styles = getFooterStyles(undefined as any);

      // Create a DOM element and apply the CSS class
      document.body.innerHTML = `<div class="${styles.footerCell}">Test</div>`;
      const element = document.querySelector('div');

      // Get the computed style
      const computedStyle = window.getComputedStyle(element!);

      // Check the CSS property
      expect(computedStyle.justifyContent).toBe('space-between');
    });

    // Clean up after all tests
    afterAll(() => {
      document.body.innerHTML = '';
    });
  });

  describe('extractPixelValue', () => {
    it('should extract numeric value from pixel string', () => {
      expect(extractPixelValue('100px')).toBe(100);
      expect(extractPixelValue('42px')).toBe(42);
      expect(extractPixelValue('0px')).toBe(0);
    });

    it('should handle numeric input', () => {
      expect(extractPixelValue(100)).toBe(100);
      expect(extractPixelValue(42)).toBe(42);
      expect(extractPixelValue(0)).toBe(0);
    });

    it('should handle string numbers without units', () => {
      expect(extractPixelValue('100')).toBe(100);
      expect(extractPixelValue('42')).toBe(42);
      expect(extractPixelValue('0')).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(extractPixelValue('100.5px')).toBe(100.5);
      expect(extractPixelValue('42.75px')).toBe(42.75);
      expect(extractPixelValue(100.5)).toBe(100.5);
    });

    it('should handle negative values', () => {
      expect(extractPixelValue('-100px')).toBe(-100);
      expect(extractPixelValue('-42px')).toBe(-42);
      expect(extractPixelValue(-100)).toBe(-100);
    });

    it('should handle other CSS units by removing them', () => {
      expect(extractPixelValue('100em')).toBe(100);
      expect(extractPixelValue('42rem')).toBe(42);
      expect(extractPixelValue('10vh')).toBe(10);
      expect(extractPixelValue('20vw')).toBe(20);
    });

    it('should handle whitespace', () => {
      expect(extractPixelValue(' 100px ')).toBe(100);
      expect(extractPixelValue(' 42 px ')).toBe(42);
    });

    it('should return 0 for invalid input when no default is provided', () => {
      expect(extractPixelValue('not-a-number')).toBe(0);
      expect(extractPixelValue('px')).toBe(0);
      expect(extractPixelValue('')).toBe(0);
      expect(extractPixelValue(null as any)).toBe(0);
      expect(extractPixelValue(undefined as any)).toBe(0);
    });
  });

  describe('convertRGBAToHex', () => {
    it('should convert RGBA format to hex with alpha', () => {
      expect(convertRGBAToHex('#181b1f', 'rgba(255, 0, 0, 1)')).toBe('#ff0000');
      expect(convertRGBAToHex('#181b1f', 'rgba(0, 255, 0, 0.5)')).toBe('#0c8d10');
      expect(convertRGBAToHex('#181b1f', 'rgba(0, 0, 255, 0)')).toBe('#181b1f');
    });
  });

  describe('getDefaultRowHeight', () => {
    const theme = createTheme();

    it('returns correct height for TableCellHeight.Sm', () => {
      const result = getDefaultRowHeight(theme, TableCellHeight.Sm);
      expect(result).toBe(36);
    });

    it('returns correct height for TableCellHeight.Md', () => {
      const result = getDefaultRowHeight(theme, TableCellHeight.Md);
      expect(result).toBe(42);
    });

    it('returns correct height for TableCellHeight.Lg', () => {
      const result = getDefaultRowHeight(theme, TableCellHeight.Lg);
      expect(result).toBe(TABLE.MAX_CELL_HEIGHT);
    });

    it('calculates height based on theme when cellHeight is undefined', () => {
      const result = getDefaultRowHeight(theme, undefined as unknown as TableCellHeight);

      // Calculate the expected result based on the theme values
      const expected = TABLE.CELL_PADDING * 2 + theme.typography.fontSize * theme.typography.body.lineHeight;

      expect(result).toBe(expected);
    });
  });

  describe('myRowRenderer', () => {
    // Create mock props for testing
    const createMockProps = (depth: number, hasData: boolean, index: number) => {
      return {
        row: {
          __depth: depth,
          __index: index,
          data: hasData ? { length: 2 } : undefined,
        },
        viewportColumns: [],
        rowIdx: 0,
        isRowSelected: false,
        onRowClick: jest.fn(),
        onRowDoubleClick: jest.fn(),
        rowClass: '',
        top: 0,
        height: 40,
        'aria-rowindex': 1,
        'aria-selected': false,
        gridRowStart: 1,
        isLastRow: false,
        selectedCellIdx: undefined,
        selectCell: jest.fn(),
        lastFrozenColumnIndex: -1,
        copiedCellIdx: undefined,
        draggedOverCellIdx: undefined,
        setDraggedOverRowIdx: jest.fn(),
        onRowChange: jest.fn(),
        rowArray: [],
        selectedPosition: { idx: 0, rowIdx: 0, mode: 'SELECT' },
      } as any;
    };

    const mockPanelContext = {
      id: 1,
      title: 'Test Panel',
      description: 'Test Description',
      width: 800,
      height: 600,
      timeRange: { from: 'now-6h', to: 'now' },
      timeZone: 'browser',
      onTimeRangeChange: jest.fn(),
      onOptionsChange: jest.fn(),
      onFieldConfigChange: jest.fn(),
      onInstanceStateChange: jest.fn(),
      replaceVariables: jest.fn(),
      eventBus: {
        publish: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
    } as unknown as PanelContext;

    const mockData = createDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [] },
        { name: 'Value', type: FieldType.number, values: [] },
      ],
    });

    it('returns null for non-expanded child rows', () => {
      const props = createMockProps(1, false, 0);
      const expandedRows: number[] = []; // No expanded rows

      const result = myRowRenderer('key-0', props, expandedRows, mockPanelContext, mockData, false);

      expect(result).toBeNull();
    });

    it('renders child rows when parent is expanded', () => {
      const props = createMockProps(1, false, 0);
      const expandedRows: number[] = [0]; // Row 0 is expanded

      const result = myRowRenderer('key-0', props, expandedRows, mockPanelContext, mockData, false);

      expect(result).not.toBeNull();
    });

    it('adds aria-expanded attribute to parent rows with nested data', () => {
      const props = createMockProps(0, true, 0);
      const expandedRows: number[] = [0]; // Row 0 is expanded

      const result = myRowRenderer('key-0', props, expandedRows, mockPanelContext, mockData, false) as JSX.Element;

      expect(result.props['aria-expanded']).toBe(true);
    });

    it('sets aria-expanded to false when parent row is not expanded', () => {
      const props = createMockProps(0, true, 0);
      const expandedRows: number[] = []; // No expanded rows

      const result = myRowRenderer('key-0', props, expandedRows, mockPanelContext, mockData, false) as JSX.Element;

      expect(result.props['aria-expanded']).toBe(false);
    });

    it('renders regular rows without aria-expanded attribute', () => {
      const props = createMockProps(0, false, 0);
      const expandedRows: number[] = [];

      const result = myRowRenderer('key-0', props, expandedRows, mockPanelContext, mockData, false) as JSX.Element;

      expect(result.props['aria-expanded']).toBeUndefined();
    });
  });
});
