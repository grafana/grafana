import {
  createDataFrame,
  createTheme,
  DataFrame,
  DataFrameWithValue,
  DisplayValue,
  Field,
  FieldType,
  GrafanaTheme2,
  LinkModel,
  ValueLinkConfig,
} from '@grafana/data';
import { BarGaugeDisplayMode, TableCellBackgroundDisplayMode, TableCellHeight } from '@grafana/schema';

import { TableCellDisplayMode } from '../types';

import { TABLE } from './constants';
import {
  extractPixelValue,
  frameToRecords,
  getAlignmentFactor,
  getCellColors,
  getCellLinks,
  getCellOptions,
  getComparator,
  getDefaultRowHeight,
  getIsNestedTable,
  getTextAlign,
  migrateTableDisplayModeToCellOptions,
  getColumnTypes,
  getMaxWrapCell,
} from './utils';

describe('TableNG utils', () => {
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

    it.todo('alignmentFactor.text = displayValue.text;');
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

    it('should recursively build column types when nested fields are present', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          {
            type: FieldType.nestedFrames,
            name: 'nestedCol',
            config: {},
            values: [
              [
                createDataFrame({
                  fields: [
                    { name: 'time', values: [1, 2] },
                    { name: 'value', values: [10, 20] },
                  ],
                }),
              ],
              [
                createDataFrame({
                  fields: [
                    { name: 'time', values: [3, 4] },
                    { name: 'value', values: [30, 40] },
                  ],
                }),
              ],
            ],
          },
        ],
        length: 0,
        name: 'test',
      };

      expect(getColumnTypes(frame.fields)).toEqual({
        stringCol: FieldType.string,
        time: FieldType.time,
        value: FieldType.number,
      });
    });

    it('does not throw if nestedFrames has no values', () => {
      const frame: DataFrame = {
        fields: [
          { type: FieldType.string, name: 'stringCol', config: {}, values: [] },
          {
            type: FieldType.nestedFrames,
            name: 'nestedCol',
            config: {},
            values: [],
          },
        ],
        length: 0,
        name: 'test',
      };

      expect(getColumnTypes(frame.fields)).toEqual({
        stringCol: FieldType.string,
      });
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

    it('should bind the onClick handlers', () => {
      const onClickHandler = jest.fn();
      // Create links with different valid configurations
      const mockLinks: LinkModel[] = [
        // Internal link with onClick handler
        {
          title: 'Internal Link',
          href: '', // Empty href for internal links
          onClick: onClickHandler,
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

      const link = links?.[0];
      const event = new MouseEvent('click', { bubbles: true });
      jest.spyOn(event, 'preventDefault');

      link?.onClick?.(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onClickHandler).toHaveBeenCalledWith(event, { field, rowIndex: 0 });
    });

    it.each([
      { keyName: 'metaKey', eventOverride: { metaKey: true } },
      { keyName: 'ctrlKey', eventOverride: { ctrlKey: true } },
      { keyName: 'shiftKey', eventOverride: { shiftKey: true } },
    ])(
      'should allow open a link in a new tab when $keyName clicked instead of using the handler',
      ({ eventOverride }) => {
        const onClickHandler = jest.fn();
        // Create links with different valid configurations
        const mockLinks: LinkModel[] = [
          // Internal link with onClick handler
          {
            title: 'Internal Link',
            href: '', // Empty href for internal links
            onClick: onClickHandler,
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

        const link = links?.[0];
        const event = new MouseEvent('click', { bubbles: true, ...eventOverride });
        jest.spyOn(event, 'preventDefault');

        link?.onClick?.(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(onClickHandler).not.toHaveBeenCalled();
      }
    );
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

  describe('getMaxWrapCell', () => {
    it('should return the maximum wrap cell length from field state', () => {
      const field1: Field = {
        name: 'field1',
        type: FieldType.string,
        config: {},
        values: ['beep boop', 'foo bar baz', 'lorem ipsum dolor sit amet'],
      };

      const field2: Field = {
        name: 'field2',
        type: FieldType.string,
        config: {},
        values: ['asdfasdf asdfasdf asdfasdf', 'asdf asdf asdf asdf asdf', ''],
      };

      const field3: Field = {
        name: 'field3',
        type: FieldType.string,
        config: {},
        values: ['foo', 'bar', 'baz'],
        // No alignmentFactors in state
      };

      const fields = [field1, field2, field3];

      const result = getMaxWrapCell(fields, 0, {
        colWidths: [30, 50, 100],
        avgCharWidth: 5,
        wrappedColIdxs: [true, true, true],
      });
      expect(result).toEqual({
        text: 'asdfasdf asdfasdf asdfasdf',
        idx: 1,
        numLines: 2.6,
      });
    });

    it('should take colWidths into account when calculating max wrap cell', () => {
      const fields: Field[] = [
        {
          name: 'field',
          type: FieldType.string,
          config: {},
          values: ['short', 'a bit longer text'],
        },
        {
          name: 'field',
          type: FieldType.string,
          config: {},
          values: ['short', 'quite a bit longer text'],
        },
        {
          name: 'field',
          type: FieldType.string,
          config: {},
          values: ['short', 'less text'],
        },
      ];

      // Simulate a narrow column width that would cause wrapping
      const colWidths = [50, 1000, 30]; // 50px width
      const avgCharWidth = 5; // Assume average character width is 5px

      const result = getMaxWrapCell(fields, 1, { colWidths, avgCharWidth, wrappedColIdxs: [true, true, true] });

      // With a 50px width and 5px per character, we can fit 10 characters per line
      // "the longest text in this field" has 31 characters, so it should wrap to 4 lines
      expect(result).toEqual({
        idx: 0,
        numLines: 1.7,
        text: 'a bit longer text',
      });
    });

    it('should use the display name if the rowIdx is -1 (which is used to calc header height in wrapped rows)', () => {
      const fields: Field[] = [
        {
          name: 'Field with a very long name',
          type: FieldType.string,
          config: {},
          values: ['short', 'a bit longer text'],
        },
        {
          name: 'Name',
          type: FieldType.string,
          config: {},
          values: ['short', 'quite a bit longer text'],
        },
        {
          name: 'Another field',
          type: FieldType.string,
          config: {},
          values: ['short', 'less text'],
        },
      ];

      // Simulate a narrow column width that would cause wrapping
      const colWidths = [50, 1000, 30]; // 50px width
      const avgCharWidth = 5; // Assume average character width is 5px

      const result = getMaxWrapCell(fields, -1, { colWidths, avgCharWidth, wrappedColIdxs: [true, true, true] });

      // With a 50px width and 5px per character, we can fit 10 characters per line
      // "the longest text in this field" has 31 characters, so it should wrap to 4 lines
      expect(result).toEqual({ idx: 0, numLines: 2.7, text: 'Field with a very long name' });
    });

    it.todo('should ignore columns which are not wrapped');

    it.todo('should only apply wrapping on idiomatic break characters (space, -, etc)');
  });
});
