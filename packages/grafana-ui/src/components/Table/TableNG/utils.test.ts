import { SortColumn } from 'react-data-grid';

import {
  createDataFrame,
  createTheme,
  DataFrame,
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

import { TABLE } from './constants';
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
  getFooterItem,
  getIsNestedTable,
  getTextAlign,
  updateSortColumns,
  migrateTableDisplayModeToCellOptions,
  getColumnTypes,
} from './utils';

describe('TableNG utils', () => {
  describe('getFooterItem', () => {
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
      const result = getFooterItem(rows, numericField, {
        show: true,
        reducer: ['sum'],
      });

      expect(result).toBe('6'); // 1 + 2 + 3
    });

    it('should calculate mean for numeric fields', () => {
      const result = getFooterItem(rows, numericField, {
        show: true,
        reducer: ['mean'],
      });

      expect(result).toBe('2'); // (1 + 2 + 3) / 3
    });

    it('should return empty string for non-numeric fields', () => {
      const result = getFooterItem(rows, textField, {
        show: true,
        reducer: ['sum'],
      });

      expect(result).toBe('');
    });

    it('should return empty string when footer not shown', () => {
      const result = getFooterItem(rows, numericField, undefined);

      expect(result).toBe('');
    });

    it('should return empty string when reducer is undefined', () => {
      const result = getFooterItem(rows, numericField, {
        show: true,
        reducer: undefined,
      });
      expect(result).toBe('');
    });

    it('should correctly calculate sum for numeric fields based on selected fields', () => {
      const numericField1Result = getFooterItem(rows, numericField, {
        show: true,
        reducer: ['sum'],
        fields: ['Field1'],
      });

      const numericField2Result = getFooterItem(rows, numericField2, {
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
    it('should set initial sort', () => {
      expect(updateSortColumns('Value', 'ASC', false, [])).toEqual([{ columnKey: 'Value', direction: 'ASC' }]);
    });

    it('should toggle sort direction on same column', () => {
      expect(updateSortColumns('Value', 'DESC', false, [{ columnKey: 'Value', direction: 'ASC' }])).toEqual([
        { columnKey: 'Value', direction: 'DESC' },
      ]);
    });

    it('should handle multi-sort with shift key', () => {
      expect(updateSortColumns('Value', 'ASC', true, [{ columnKey: 'Time', direction: 'ASC' }])).toEqual([
        { columnKey: 'Time', direction: 'ASC' },
        { columnKey: 'Value', direction: 'ASC' },
      ]);
    });

    it('should remove sort when toggling through all states', () => {
      let cols: SortColumn[] = [{ columnKey: 'Value', direction: 'ASC' }];

      // Toggle to DESC
      cols = updateSortColumns('Value', 'DESC', false, cols);
      expect(cols).toEqual([{ columnKey: 'Value', direction: 'DESC' }]);

      // Toggle to no sort
      cols = updateSortColumns('Value', 'DESC', false, cols);
      expect(cols).toEqual([]);
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

  describe('getColumnTypes', () => {
    it('builds the expected record with column types', () => {
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
      const result = getColumnTypes(fields);

      expect(result).toEqual({
        name: FieldType.string,
        age: FieldType.number,
        active: FieldType.boolean,
      });
    });

    it.todo('should recursively build column types when nested fields are present');
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
      expect(getIsNestedTable(frame.fields)).toBe(true);
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
      expect(getIsNestedTable(frame.fields)).toBe(false);
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
});
