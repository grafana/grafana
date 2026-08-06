import { FieldType, type Field, type GrafanaTheme2 } from '@grafana/data';
import { BarGaugeDisplayMode, TableCellBackgroundDisplayMode } from '@grafana/schema';

import { TableCellDisplayMode } from '../../types';
import { getJustifyContent } from '../styles';

import { getAlignment, getCellOptions, migrateTableDisplayModeToCellOptions } from './cellOptions';
import { getCellColorInlineStylesFactory } from './colors';

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
