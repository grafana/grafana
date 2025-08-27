import { SortColumn } from 'react-data-grid';

import {
  createDataFrame,
  createTheme,
  DataFrame,
  DataFrameWithValue,
  DataLink,
  DisplayValue,
  Field,
  FieldType,
  GrafanaTheme2,
  LinkModel,
  ValueLinkConfig,
} from '@grafana/data';
import { BarGaugeDisplayMode, TableCellBackgroundDisplayMode, TableCellHeight } from '@grafana/schema';

import { TableCellDisplayMode } from '../types';

import { COLUMN, TABLE } from './constants';
import { MeasureCellHeightEntry } from './types';
import {
  extractPixelValue,
  frameToRecords,
  getAlignmentFactor,
  getCellColorInlineStylesFactory,
  getCellLinks,
  getCellOptions,
  getComparator,
  getIsNestedTable,
  getAlignment,
  getJustifyContent,
  migrateTableDisplayModeToCellOptions,
  getColumnTypes,
  computeColWidths,
  getRowHeight,
  buildCellHeightMeasurers,
  buildHeaderHeightMeasurers,
  getTextHeightEstimator,
  createTypographyContext,
  applySort,
  SINGLE_LINE_ESTIMATE_THRESHOLD,
  getTextHeightMeasurerFromUwrapCount,
  getDataLinksHeightMeasurer,
  getPillCellHeightMeasurer,
  getDefaultRowHeight,
  getDisplayName,
  predicateByName,
} from './utils';

describe('TableNG utils', () => {
  describe('alignment', () => {
    it.each(['left', 'center', 'right'] as const)('should return "%s" when configured', (align) => {
      expect(getAlignment({ name: 'Value', type: FieldType.string, values: [], config: { custom: { align } } })).toBe(
        align
      );
    });

    it.each([
      { type: FieldType.string, align: 'left' },
      { type: FieldType.number, align: 'right' },
      { type: FieldType.boolean, align: 'left' },
      { type: FieldType.time, align: 'left' },
    ])('should return "$align" for field type $type by default', ({ type, align }) => {
      expect(getAlignment({ name: 'Test', type, values: [], config: { custom: {} } })).toBe(align);
    });

    it.each([
      { cellType: undefined, align: 'right' },
      { cellType: TableCellDisplayMode.Auto, align: 'right' },
      { cellType: TableCellDisplayMode.ColorText, align: 'right' },
      { cellType: TableCellDisplayMode.ColorBackground, align: 'right' },
      { cellType: TableCellDisplayMode.Gauge, align: 'left' },
      { cellType: TableCellDisplayMode.JSONView, align: 'left' },
      { cellType: TableCellDisplayMode.DataLinks, align: 'left' },
    ])('numeric field should return "$align" for cell type "$cellType"', ({ align, cellType }) => {
      expect(
        getAlignment({
          name: 'Test',
          type: FieldType.number,
          values: [],
          config: { custom: { ...(cellType !== undefined ? { cellOptions: { type: cellType } } : {}) } },
        })
      ).toBe(align);
    });

    describe('mapping to getJustifyContent', () => {
      it.each([
        { align: 'left', expected: 'flex-start' },
        { align: 'center', expected: 'center' },
        { align: 'right', expected: 'flex-end' },
      ] as const)(`should map align "$align" to justifyContent "$expected"`, ({ align, expected }) => {
        expect(getJustifyContent(align)).toBe(expected);
      });
    });
  });

  describe('cell display mode', () => {
    const theme = {
      colors: {
        isDark: true,
        mode: 'dark',
        primary: { text: '#FFFFFF', main: '#FF0000' },
        background: { canvas: '#000000', primary: '#111111' },
        text: { primary: '#FFFFFF' },
        action: { hover: '#FF0000' },
      },
    } as unknown as GrafanaTheme2;

    it('should handle color text cell type', () => {
      const cellOptions = {
        type: TableCellDisplayMode.ColorText as const,
      };

      const displayValue = { text: '100', numeric: 100, color: '#ff0000' };

      const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
      const colors = getCellColorInlineStyles(cellOptions, displayValue, false);
      expect(colors.color).toBe('#ff0000');
      expect(colors).not.toHaveProperty('background');
    });

    it('should pass thru color background cell type in basic mode', () => {
      const cellOptions = {
        type: TableCellDisplayMode.ColorBackground as const,
        mode: TableCellBackgroundDisplayMode.Basic,
      };

      const displayValue = { text: '100', numeric: 100, color: '#ff0000' };

      const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
      const colors = getCellColorInlineStyles(cellOptions, displayValue, false);
      expect(colors.background).toBe('#ff0000');
      expect(colors.color).toBe('rgb(247, 248, 250)');
    });

    it('should handle color background cell type in gradient mode', () => {
      const cellOptions = {
        type: TableCellDisplayMode.ColorBackground as const,
        mode: TableCellBackgroundDisplayMode.Gradient,
      };

      const displayValue = { text: '100', numeric: 100, color: '#ff0000' };

      const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
      const colors = getCellColorInlineStyles(cellOptions, displayValue, false);
      expect(colors.background).toBe('linear-gradient(120deg, rgb(255, 54, 36), #ff0000)');
      expect(colors.color).toBe('rgb(247, 248, 250)');
    });

    it('does not set CSSProperties for un-mapped cell types', () => {
      const cellOptions = { type: TableCellDisplayMode.JSONView as const };

      const displayValue = { text: '100', numeric: 100, color: '#ff0000' };

      const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
      const colors = getCellColorInlineStyles(cellOptions, displayValue, false);

      expect(colors).toEqual({});
    });

    describe('applyToRow', () => {
      it.each([
        ['hex', '#ffffff00'],
        ['rgba', 'rgba(255,255,255,0)'],
        ['hsla', 'hsla(0,100%,100%,0)'],
      ])(
        'should not apply background color if the display value is transparent (%s) and applyToRow is on',
        (_format, colorDisplayValue) => {
          const cellOptions = {
            type: TableCellDisplayMode.ColorBackground as const,
            mode: TableCellBackgroundDisplayMode.Basic,
          };

          const displayValue = { text: '100', numeric: 100, color: colorDisplayValue };

          const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
          const colors = getCellColorInlineStyles(cellOptions, displayValue, true);

          expect(colors).toEqual({});
        }
      );

      it.each([
        ['hex', '#ffffff00'],
        ['rgba', 'rgba(255,255,255,0)'],
        ['hsla', 'hsla(0,100%,100%,0)'],
      ])(
        'should apply background color if the display value is transparent (%s) and applyToRow is off',
        (_format, colorDisplayValue) => {
          const cellOptions = {
            type: TableCellDisplayMode.ColorBackground as const,
            mode: TableCellBackgroundDisplayMode.Basic,
          };

          const displayValue = { text: '100', numeric: 100, color: colorDisplayValue };

          const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
          const colors = getCellColorInlineStyles(cellOptions, displayValue, false);

          expect(colors).toEqual({
            background: colorDisplayValue,
            color: 'rgb(32, 34, 38)',
          });
        }
      );
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
      expect(records[0]).toEqual({ __depth: 0, __index: 0, time: 1, value: 10 });
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
        display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
      };

      // Create a display value
      const displayValue: DisplayValue = { text: '1', numeric: 1 };

      // Call getAlignmentFactor with the first row
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result has the text property
      expect(result).toEqual(expect.objectContaining({ text: '1' }));

      // Verify that field.state was created and contains the alignment factor
      expect(field.state).toBeDefined();
      expect(field.state?.alignmentFactors).toBeDefined();
      expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
    });

    it('should update alignment factor when a longer value is found', () => {
      // Create a field with an existing alignment factor
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        state: { alignmentFactors: { text: '1' } },
        display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
      };

      // Create a display value that is longer than the existing alignment factor
      const displayValue: DisplayValue = { text: '4444', numeric: 4444 };

      // Call getAlignmentFactor
      const result = getAlignmentFactor(field, displayValue, 3);

      // Verify the result is updated to the longer value
      expect(result).toEqual(expect.objectContaining({ text: '4444' }));

      // Verify that field.state.alignmentFactors was updated
      expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
    });

    it('should not update alignment factor when a shorter value is found', () => {
      // Create a field with an existing alignment factor for a long value
      const field: Field = {
        name: 'test',
        type: FieldType.number,
        config: {},
        values: [1, 22, 333, 4444],
        state: { alignmentFactors: { text: '4444' } },
        display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
      };

      // Create a display value that is shorter than the existing alignment factor
      const displayValue: DisplayValue = { text: '1', numeric: 1 };

      // Call getAlignmentFactor
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result is still the longer value
      expect(result).toEqual(expect.objectContaining({ text: '4444' }));

      // Verify that field.state.alignmentFactors was not changed
      expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
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
        display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
      };

      // Create a display value
      const displayValue: DisplayValue = { text: '1', numeric: 1 };

      // Call getAlignmentFactor with the first row
      const result = getAlignmentFactor(field, displayValue, 0);

      // Verify the result has the text property
      expect(result).toEqual(expect.objectContaining({ text: '1' }));

      // Verify that field.state was preserved and alignment factor was added
      expect(field.state).toBeDefined();
      // Check for the valid property we used
      expect(field.state?.calcs).toBeDefined();
      expect(field.state?.alignmentFactors).toBeDefined();
      expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
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

      expect(result).toEqual({ name: FieldType.string, age: FieldType.number, active: FieldType.boolean });
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
          { type: FieldType.nestedFrames, name: 'nestedCol', config: {}, values: [] },
        ],
        length: 0,
        name: 'test',
      };

      expect(getColumnTypes(frame.fields)).toEqual({ stringCol: FieldType.string });
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
      expect(result).toEqual({ type: TableCellDisplayMode.Gauge, mode: BarGaugeDisplayMode.Basic });
    });

    it('should migrate gradient-gauge to gauge mode with gradient', () => {
      const result = migrateTableDisplayModeToCellOptions(TableCellDisplayMode.GradientGauge);
      expect(result).toEqual({ type: TableCellDisplayMode.Gauge, mode: BarGaugeDisplayMode.Gradient });
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
      expect(result).toEqual({ type: TableCellDisplayMode.ColorText });
    });
  });

  describe('getCellOptions', () => {
    it('should return default options when no custom config is provided', () => {
      const field: Field = { name: 'test', type: FieldType.string, config: {}, values: [] };

      const options = getCellOptions(field);

      // Check that default options are returned
      expect(options).toEqual({ type: TableCellDisplayMode.Auto });
    });

    it('should extract cell options from field config', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          custom: { cellOptions: { type: TableCellDisplayMode.ColorText, inspectEnabled: false } },
        },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options).toEqual({ type: TableCellDisplayMode.ColorText, inspectEnabled: false });
    });

    it('should handle legacy displayMode property', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: { custom: { displayMode: 'color-background' } },
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
        config: { custom: { displayMode: 'color-background', cellOptions: { type: TableCellDisplayMode.ColorText } } },
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
        config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
        values: [],
      };

      const options = getCellOptions(field);

      expect(options.type).toBe(TableCellDisplayMode.JSONView);
    });
  });

  describe('getCellLinks', () => {
    it('should return undefined when field has no getLinks function', () => {
      const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['value'] };

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

    it('should filter out links which contain neither href nor onClick', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: (): LinkModel[] => [
          { title: 'Invalid Link', target: '_blank', origin: { datasourceUid: 'test' } } as LinkModel, // No href or onClick
        ],
      };

      const links = getCellLinks(field, 0);
      expect(links).toEqual([]);
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

  describe('getDefaultRowHeight', () => {
    const theme = createTheme();

    it.each([
      { input: TableCellHeight.Sm, expected: 36 },
      { input: TableCellHeight.Md, expected: 42 },
      { input: TableCellHeight.Lg, expected: TABLE.MAX_CELL_HEIGHT },
    ])('returns "$expected" for "$input"', ({ input, expected }) => {
      const result = getDefaultRowHeight(theme, [], input);
      expect(result).toBe(expected);
    });

    it('returns "auto" if a field is present with the dynamicHeight cellOption  is false', () => {
      expect(
        getDefaultRowHeight(
          theme,
          [
            {
              name: 'test1',
              type: FieldType.string,
              config: {},
              values: ['value1'],
            },
            {
              name: 'test2',
              type: FieldType.string,
              config: { custom: { cellOptions: { type: TableCellDisplayMode.Markdown, dynamicHeight: true } } },
              values: ['value1'],
            },
            {
              name: 'test3',
              type: FieldType.number,
              config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
              values: [3],
            },
          ],
          TableCellHeight.Sm
        )
      ).toBe('auto');
    });

    it('calculates height based on theme when cellHeight is undefined', () => {
      const result = getDefaultRowHeight(theme, []);

      // Calculate the expected result based on the theme values
      const expected = TABLE.CELL_PADDING * 2 + theme.typography.fontSize * theme.typography.body.lineHeight;

      expect(result).toBe(expected);
    });
  });

  describe('createTypographyCtx', () => {
    // we can't test the effectiveness of this typography context in unit tests, only that it
    // actually executed the JS correctly. If you called `count` with a sensible value and width,
    // it wouldn't give you a very reasonable answer in Jest's DOM environment for some reason.
    it('creates the context using uwrap', () => {
      const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };
      const ctx = createTypographyContext(14, 'sans-serif', 0.15);

      expect(ctx).toEqual(
        expect.objectContaining({
          ctx: expect.any(CanvasRenderingContext2D),
          fontFamily: 'sans-serif',
          letterSpacing: 0.15,
          measureHeight: expect.any(Function),
          estimateHeight: expect.any(Function),
          avgCharWidth: expect.any(Number),
        })
      );
      expect(ctx.measureHeight('the quick brown fox jumps over the lazy dog', 100, field, 0, 20)).toEqual(
        expect.any(Number)
      );
      expect(ctx.estimateHeight('the quick brown fox jumps over the lazy dog', 100, field, 0, 20)).toEqual(
        expect.any(Number)
      );
    });
  });

  describe('getTextHeightMeasurerFromUwrapCount', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };

    it('wraps the uwrap count function', () => {
      const measureHeight = getTextHeightMeasurerFromUwrapCount(jest.fn(() => 2));
      expect(measureHeight('test string', 100, field, 0, 20)).toBe(40);
    });

    it("returns a single line's height for null or undefined values", () => {
      const measureHeight = getTextHeightMeasurerFromUwrapCount(jest.fn(() => 2));
      expect(measureHeight(null, 100, field, 0, 20)).toBe(20);
      expect(measureHeight(undefined, 100, field, 0, 20)).toBe(20);
    });
  });

  describe('getTextHeightEstimator', () => {
    const estimator = getTextHeightEstimator(10);
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['foo', 'bar', 'baz'] };

    it('returns -1 if there are no strings or dashes within the string', () => {
      expect(estimator('asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf', 5, field, 0, 22)).toBe(-1);
    });

    it('calculates an approximate rendered height for the text based on the width and avgCharWidth', () => {
      expect(estimator('asdfas dfasdfasdf asdfasdfasdfa sdfasdfasdfasdf 23', 200, field, 0, 20)).toBe(60);
    });
  });

  describe('getDataLinksHeightMeasurer', () => {
    it('counts number of valid links using getCellLinks', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {
          links: [
            { title: 'Link 1', url: 'http://example.com/1' },
            { title: 'Invalid Link' } as DataLink, // No href or onClick
            {
              title: 'Link w',
              url: 'asdf',
              onClick: jest.fn(() => {}),
            },
          ],
        },
        values: ['value1'],
      };

      const measurer = getDataLinksHeightMeasurer();
      expect(measurer('my value', 100, field, 0, 20)).toBe(40);
    });
  });

  describe('getPillCellHeightMeasurer', () => {
    it('counts up the number of lines using the pill measuring method', () => {
      const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
      expect(measurer('tag1,tag2', 100, {} as Field, 0, 20)).toBe(20);
      expect(measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20)).toBe(68);
    });

    it('returns 0 if value is null', () => {
      const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
      expect(measurer(null, 100, {} as Field, 0, 20)).toBe(0);
    });

    it('returns 0 if no pills are inferred', () => {
      const measurer = getPillCellHeightMeasurer(jest.fn((str) => str.length * 5));
      expect(measurer('', 100, {} as Field, 0, 20)).toBe(0);
    });

    it('caches the width measurement for the same value', () => {
      const widthMeasurement = jest.fn((str) => str.length * 5);
      const measurer = getPillCellHeightMeasurer(widthMeasurement);
      measurer('tag1,tag2,tag3,tag4,tag5,tag6', 100, {} as Field, 0, 20);
      measurer('tag1,tag2', 100, {} as Field, 0, 20);
      measurer('tag2', 200, {} as Field, 0, 20);
      measurer('tag2,tag3,tag2,tag4,tag4,tag2,tag5', 300, {} as Field, 0, 20);
      expect(widthMeasurement).toHaveBeenCalledTimes(6); // Should only call for unique values
    });
  });

  describe('buildHeaderHeightMeasurers', () => {
    const ctx = {
      fontFamily: 'sans-serif',
      letterSpacing: 0.15,
      ctx: {} as CanvasRenderingContext2D,
      count: jest.fn(() => 2),
      avgCharWidth: 7,
      measureHeight: jest.fn(() => 2),
      estimateHeight: jest.fn(() => 2),
    };

    it('returns an array of measurers for each column', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: { wrapHeaderText: true } } },
        { name: 'Age', type: FieldType.number, values: [], config: { custom: { wrapHeaderText: true } } },
      ];
      const measurers = buildHeaderHeightMeasurers(fields, ctx);
      expect(measurers![0].measure).toEqual(expect.any(Function));
      expect(measurers![0].fieldIdxs).toEqual([0, 1]);
    });

    it('does not return the index of columns which are not wrapped', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
        { name: 'Age', type: FieldType.number, values: [], config: { custom: { wrapHeaderText: true } } },
      ];

      const measurers = buildHeaderHeightMeasurers(fields, ctx);
      expect(measurers![0].fieldIdxs).toEqual([1]);
    });

    it('returns undefined if no columns are wrapped', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
        { name: 'Age', type: FieldType.number, values: [], config: { custom: {} } },
      ];

      const measurers = buildHeaderHeightMeasurers(fields, ctx);
      expect(measurers).toBeUndefined();
    });
  });

  describe('buildCellHeightMeasurers', () => {
    const ctx = {
      fontFamily: 'sans-serif',
      letterSpacing: 0.15,
      ctx: {} as CanvasRenderingContext2D,
      measureHeight: jest.fn(() => 2),
      estimateHeight: jest.fn(() => 2),
      avgCharWidth: 7,
    };

    it('sets up text height measurers for each text column if wrapping is on', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: { wrapText: true } } },
        {
          name: 'Address',
          type: FieldType.string,
          values: [],
          config: { custom: { wrapText: true } },
        },
      ];
      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers![0].measure).toEqual(expect.any(Function));
      expect(measurers![0].fieldIdxs).toEqual([0, 1]);
    });

    it('does not return the index of columns which are not wrapped', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
        {
          name: 'Address',
          type: FieldType.string,
          values: [],
          config: { custom: { wrapText: true } },
        },
      ];

      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers![0].fieldIdxs).toEqual([1]);
    });

    it('sets up line counting for pills if present and wrapping is on', () => {
      const fields: Field[] = [
        {
          name: 'Tags',
          type: FieldType.string,
          values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
          config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
        },
      ];
      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers![0].estimate).toEqual(expect.any(Function));
      expect(measurers![0].estimate!('tag1,tag2', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
      expect(measurers![0].measure).toEqual(expect.any(Function));
      expect(measurers![0].measure('tag1,tag2', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
      expect(measurers![0].fieldIdxs).toEqual([0]);
    });

    it('sets up line counting for datalinks if present and wrapping is on', () => {
      const fields: Field[] = [
        {
          name: 'Links',
          type: FieldType.string,
          values: ['http://example.com/1', 'http://example.com/2'],
          config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.DataLinks } } },
          getLinks: jest.fn((): LinkModel[] => [
            { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
            { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
          ]),
        },
      ];
      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers![0].measure).toEqual(expect.any(Function));
      expect(measurers![0].measure('http://example.com/1', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
      expect(measurers![0].fieldIdxs).toEqual([0]);
    });

    it('does not enable text counting for non-string fields', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
        { name: 'Age', type: FieldType.number, values: [], config: { custom: { wrapText: true } } },
      ];

      const measurers = buildCellHeightMeasurers(fields, ctx);
      // empty array - we had one column that indicated it wraps, but it was numeric, so we just ignore it
      expect(measurers).toBeUndefined();
    });

    it('returns an undefined if no columns are wrapped', () => {
      const fields: Field[] = [
        { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
        { name: 'Age', type: FieldType.number, values: [], config: { custom: {} } },
      ];

      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers).toBeUndefined();
    });

    it('clamps by maxHeight if set', () => {
      const fields: Field[] = [
        {
          name: 'Tags',
          type: FieldType.string,
          values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
          config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
        },
      ];
      const measurers = buildCellHeightMeasurers(fields, ctx);
      expect(measurers![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBeGreaterThan(50);

      fields[0].config!.custom!.maxHeight = 50;
      const measurersWithMax = buildCellHeightMeasurers(fields, ctx);
      expect(measurersWithMax![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBe(50);
    });
  });

  describe('getRowHeight', () => {
    let fields: Field[];
    let measurers: MeasureCellHeightEntry[];

    beforeEach(() => {
      fields = [
        {
          name: 'Name',
          type: FieldType.string,
          values: ['foo', 'bar', 'baz', 'longer one here', 'shorter'],
          config: { custom: { wrapText: true } },
        },
        {
          name: 'Age',
          type: FieldType.number,
          values: [1, 2, 3, 123456, 789122349932],
          config: { custom: { wrapText: true } },
        },
      ];
      measurers = [
        {
          measure: jest.fn(
            (value, _length, _field, _rowIdx, lineHeight) => String(value).split(' ').length * lineHeight
          ),
          fieldIdxs: [0],
        }, // Mocked to count words as lines
        {
          measure: jest.fn(
            (value, _length, _field, _rowIdx, lineHeight) => Math.ceil(String(value).length / 3) * lineHeight
          ),
          fieldIdxs: [1],
        }, // Mocked to return a line for every 3 digits of a number
      ];
    });

    it('should use the default height for single-line rows', () => {
      // 1 line @ 20px, 10px vertical padding = 30, minimum is 36
      expect(getRowHeight(fields, 0, [30, 30], 36, measurers, 20, 10)).toBe(36);
    });

    it('should use the default height for multi-line rows which are shorter than the default height', () => {
      // 3 lines @ 5px, 5px vertical padding = 20, minimum is 36
      expect(getRowHeight(fields, 3, [30, 30], 36, measurers, 5, 5)).toBe(36);
    });

    it('should return the row height using line measurers for multi-line', () => {
      // 3 lines @ 20px ('longer', 'one', 'here'), 10px vertical padding
      expect(getRowHeight(fields, 3, [30, 30], 36, measurers, 20, 10)).toBe(70);

      // 4 lines @ 15px (789 122 349 932), 15px vertical padding
      expect(getRowHeight(fields, 4, [30, 30], 36, measurers, 15, 15)).toBe(75);
    });

    it('should take colWidths into account when calculating max wrap cell', () => {
      getRowHeight(fields, 3, [50, 60], 36, measurers, 20, 10);
      expect(measurers[0].measure).toHaveBeenCalledWith('longer one here', 50, fields[0], 3, 20);
      expect(measurers[1].measure).toHaveBeenCalledWith(123456, 60, fields[1], 3, 20);
    });

    // this is used to calc wrapped header height
    it('should use the display name if the rowIdx is -1', () => {
      getRowHeight(fields, -1, [50, 60], 36, measurers, 20, 10);
      expect(measurers[0].measure).toHaveBeenCalledWith('Name', 50, fields[0], -1, 20);
      expect(measurers[1].measure).toHaveBeenCalledWith('Age', 60, fields[1], -1, 20);
    });

    it('should ignore columns which do not have measurers', () => {
      const height = getRowHeight(fields, 3, [30, 30], 36, [measurers[1]], 20, 10);
      // 2 lines @ 20px, 10px vertical padding (not 3 lines, since we don't line count Name)
      expect(height).toBe(50);
    });

    it('should return the default height if there are no measurers to apply', () => {
      const height = getRowHeight(fields, 3, [30, 30], 36, [], 20, 10);
      expect(height).toBe(36);
    });

    describe('estimations vs. precise counts', () => {
      beforeEach(() => {
        measurers = [
          {
            measure: jest.fn(
              (value, _length, _field, _rowIdx, lineHeight) => String(value).split(' ').length * lineHeight
            ),
            fieldIdxs: [0],
          }, // Mocked to count words as lines
          {
            measure: jest.fn(
              (value, _length, _field, _rowIdx, lineHeight) => Math.ceil(String(value).length / 3) * lineHeight
            ),
            estimate: jest.fn((value, _length, _field, _rowIdx, lineHeight) => String(value).length * lineHeight), // Mocked to return a line for every digits of a number
            fieldIdxs: [1],
          }, // Mocked to return a line for every 3 digits of a number
        ];
      });

      // 2 lines @ 20px (123,456), 10px vertical padding. when we did this before, 'longer one here' would win, making it 70px.
      // the `estimate` function is picking `123456` as the longer one now (6 lines), then the `measure` function is used
      // to calculate the height (2 lines). this is a very forced case, but we just want to prove that it actually works.
      it('uses the estimate value rather than the precise value to select the row height', () => {
        expect(getRowHeight(fields, 3, [30, 30], 36, measurers, 20, 10)).toBe(50);
      });

      it('returns doesnt bother getting the precise count if the estimates are all below the threshold', () => {
        jest.mocked(measurers[0].measure).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - 0.3);
        jest.mocked(measurers[1].estimate!).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - 0.1);

        expect(getRowHeight(fields, 3, [30, 30], 36, measurers, 20, 10)).toBe(36);

        // this is what we really care about - we want to save on performance by not calling the measure in this case.
        expect(measurers[1].measure).not.toHaveBeenCalled();
      });

      it('uses the precise count if the estimate is above the threshold, even if its below 1', () => {
        // NOTE: if this fails, just change the test to use a different value besides 1
        const thresholdOffset = 1;
        expect(SINGLE_LINE_ESTIMATE_THRESHOLD + thresholdOffset).toBeLessThan(TABLE.LINE_HEIGHT);

        jest.mocked(measurers[0].measure).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD - thresholdOffset);
        jest.mocked(measurers[1].estimate!).mockReturnValue(SINGLE_LINE_ESTIMATE_THRESHOLD + thresholdOffset);

        expect(getRowHeight(fields, 3, [30, 30], 36, measurers, 20, 10)).toBe(50);
      });
    });
  });

  describe('computeColWidths', () => {
    it('returns the configured widths if all columns set them', () => {
      expect(
        computeColWidths(
          [
            { name: 'A', type: FieldType.string, values: [], config: { custom: { width: 100 } } },
            { name: 'B', type: FieldType.string, values: [], config: { custom: { width: 200 } } },
          ],
          500
        )
      ).toEqual([100, 200]);
    });

    it('fills the available space if a column has no width set', () => {
      expect(
        computeColWidths(
          [
            { name: 'A', type: FieldType.string, values: [], config: {} },
            { name: 'B', type: FieldType.string, values: [], config: { custom: { width: 200 } } },
          ],
          500
        )
      ).toEqual([300, 200]);
    });

    it('applies minimum width when auto width would dip below it', () => {
      expect(
        computeColWidths(
          [
            { name: 'A', type: FieldType.string, values: [], config: { custom: { minWidth: 100 } } },
            { name: 'B', type: FieldType.string, values: [], config: { custom: { minWidth: 100 } } },
          ],
          100
        )
      ).toEqual([100, 100]);
    });

    it('should use the global column default width when nothing is set', () => {
      expect(
        computeColWidths(
          [
            { name: 'A', type: FieldType.string, values: [], config: {} },
            { name: 'B', type: FieldType.string, values: [], config: {} },
          ],
          // we have two columns but have set the table to the width of one default column.
          COLUMN.DEFAULT_WIDTH
        )
      ).toEqual([COLUMN.DEFAULT_WIDTH, COLUMN.DEFAULT_WIDTH]);
    });
  });

  describe('displayJsonValue', () => {
    it.todo('should parse and then stringify string values');
    it.todo('should not throw for non-serializable string values');
    it.todo('should stringify non-string values');
    it.todo('should not throw for non-serializable non-string values');
  });

  describe('applySort', () => {
    it('sorts by nanos', () => {
      const frame = createDataFrame({
        fields: [
          { name: 'time', values: [1, 1, 2], nanos: [100, 99, 0] },
          { name: 'value', values: [10, 20, 30] },
        ],
      });

      const sortColumns: SortColumn[] = [{ columnKey: 'time', direction: 'ASC' }];

      const records = applySort(frameToRecords(frame), frame.fields, sortColumns);

      expect(records).toMatchObject([
        { time: 1, value: 20 },
        { time: 1, value: 10 },
        { time: 2, value: 30 },
      ]);
    });
  });

  describe('getDisplayName', () => {
    it('should return the display name if set', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        state: { displayName: 'Test Display Name' },
        values: [],
      };
      expect(getDisplayName(field)).toBe('Test Display Name');
    });

    it('should return the field name if no display name is set', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        state: {},
        config: {},
        values: [],
      };
      expect(getDisplayName(field)).toBe('test');
    });
  });

  describe('predicateByName', () => {
    it('should return true for matching field names', () => {
      const field: Field = { name: 'test', type: FieldType.string, config: {}, values: [] };
      const predicate = predicateByName('test');
      expect(predicate(field)).toBe(true);
    });

    it('should return true for a matching display name', () => {
      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        state: { displayName: 'Test Display Name' },
        values: [],
      };
      const predicate = predicateByName('Test Display Name');
      expect(predicate(field)).toBe(true);
    });

    it('should return false for non-matching field names', () => {
      const field: Field = { name: 'test', type: FieldType.string, config: {}, values: [] };
      const predicate = predicateByName('other');
      expect(predicate(field)).toBe(false);
    });
  });
});
