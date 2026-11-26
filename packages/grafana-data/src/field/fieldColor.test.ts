import tinycolor from 'tinycolor2';

import { getContrastRatio } from '../themes/colorManipulator';
import { createTheme } from '../themes/createTheme';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';
import { type FieldColorAssignment, FieldColorModeId } from '../types/fieldColor';
import { MappingType } from '../types/valueMapping';

import { getDisplayProcessor } from './displayProcessor';
import {
  supportsFieldColorAssignment,
  fieldColorModeRegistry,
  getFieldColorMode,
  getFieldColorModeForField,
  getFieldColorPalette,
  isReversibleFieldColorMode,
  type FieldValueColorCalculator,
} from './fieldColor';
import { cacheFieldDisplayNames } from './fieldState';
import { getFieldSeriesColor } from './scale';

function getTestField(mode: string, fixedColor?: string, name = 'name'): Field {
  return {
    name: name,
    type: FieldType.number,
    values: [],
    config: {
      color: {
        mode: mode,
        fixedColor: fixedColor,
      },
    },
    state: {},
  };
}

interface GetCalcOptions {
  mode: string;
  seriesIndex?: number;
  name?: string;
  fixedColor?: string;
}

function getCalculator(options: GetCalcOptions): FieldValueColorCalculator {
  const field = getTestField(options.mode, options.fixedColor, options.name);
  const mode = fieldColorModeRegistry.get(options.mode);
  field.state!.seriesIndex = options.seriesIndex;
  return mode.getCalculator(field, createTheme());
}

describe('fieldColorModeRegistry', () => {
  it('Schemes should interpolate', () => {
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });
    expect(calcFn(70, 0.5, undefined)).toEqual('rgb(226, 192, 61)');
  });

  it('Palette classic with series index 0', () => {
    const calcFn = getCalculator({ mode: FieldColorModeId.PaletteClassic, seriesIndex: 0, name: 'series1' });
    expect(calcFn(70, 0, undefined)).toEqual('#73BF69');
  });

  it('Palette classic with series index 1', () => {
    const calcFn = getCalculator({ mode: FieldColorModeId.PaletteClassic, seriesIndex: 1, name: 'series2' });
    expect(calcFn(70, 0, undefined)).toEqual('#F2CC0C');
  });

  it('Palette uses name', () => {
    const calcFn1 = getCalculator({ mode: FieldColorModeId.PaletteClassicByName, seriesIndex: 0, name: 'same name' });
    const calcFn2 = getCalculator({ mode: FieldColorModeId.PaletteClassicByName, seriesIndex: 1, name: 'same name' });
    expect(calcFn1(12, 34, undefined)).toEqual(calcFn2(56, 78, undefined));
  });

  it('Palette uses displayName with Value fields', () => {
    let frames: DataFrame[] = [
      {
        length: 0,
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: [],
            config: {},
          },
          {
            name: 'Value',
            labels: { foo: 'bar' },
            type: FieldType.number,
            values: [],
            config: {
              color: {
                mode: FieldColorModeId.PaletteClassicByName,
              },
            },
            state: {},
          },
        ],
      },
      {
        length: 0,
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: [],
            config: {},
          },
          {
            name: 'Value',
            labels: { foo: 'baz' },
            type: FieldType.number,
            values: [],
            config: {
              color: {
                mode: FieldColorModeId.PaletteClassicByName,
              },
            },
            state: {},
          },
        ],
      },
    ];

    cacheFieldDisplayNames(frames);

    const mode = fieldColorModeRegistry.get(FieldColorModeId.PaletteClassicByName);

    const calcFn1 = mode.getCalculator(frames[0].fields[1], createTheme());
    const calcFn2 = mode.getCalculator(frames[1].fields[1], createTheme());

    expect(calcFn1(0, 0)).toEqual('#5195CE');
    expect(calcFn2(0, 0)).toEqual('#37872D');
  });

  it('When color.seriesBy is set to last use that instead of v', () => {
    const field = getTestField('continuous-GrYlRd');

    field.config.color!.seriesBy = 'last';
    // min = -10, max = 10, last = 5
    // last percent 75%
    field.values = [0, -10, 5, 10, 2, 5];

    const color = getFieldSeriesColor(field, createTheme());
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });

    expect(color.color).toEqual(calcFn(4, 0.75));
  });

  it('Shades should return selected color for index 0', () => {
    const color = '#123456';
    const calcFn = getCalculator({ mode: FieldColorModeId.Shades, seriesIndex: 0, fixedColor: color });
    expect(calcFn(70, 0, undefined)).toEqual(color);
  });

  it('Shades should return different than selected color for index 1', () => {
    const color = '#123456';
    const calcFn = getCalculator({ mode: FieldColorModeId.Shades, seriesIndex: 1, fixedColor: color });
    expect(calcFn(70, 0, undefined)).not.toEqual(color);
  });

  it.each([
    [FieldColorModeId.PaletteCategoricalNext, '#D97E9B'],
    [FieldColorModeId.PaletteCategoricalNext2, '#63B564'],
    [FieldColorModeId.PaletteCategoricalNext3, '#63B564'],
  ])('Experimental categorical palette %s is registered and assigns by series index', (mode, firstColor) => {
    const registered = fieldColorModeRegistry.getIfExists(mode);
    expect(registered).toBeDefined();

    const calcFn = getCalculator({ mode, seriesIndex: 0, name: 'series1' });
    expect(calcFn(70, 0, undefined)).toEqual(firstColor);
  });
});

describe('reverse color scheme', () => {
  const theme = createTheme();

  function getReversedField(mode: string, reverse?: boolean): Field {
    return { ...getTestField(mode), config: { color: { mode, reverse } } };
  }

  it('returns the colors of a list based scheme in reverse order', () => {
    const reversed = getFieldColorModeForField(getReversedField(FieldColorModeId.ContinuousGrYlRd, true));

    expect(reversed.getColors!(theme)).toEqual(['red', 'yellow', 'green'].map(theme.visualization.getColorByName));
  });

  it('returns a reversed palette for categorical color selection', () => {
    expect(getFieldColorPalette(getReversedField(FieldColorModeId.ContinuousGrYlRd, true), theme)).toEqual(
      ['red', 'yellow', 'green'].map(theme.visualization.getColorByName)
    );
  });

  it('mirrors the interpolator of an interpolated scheme', () => {
    const field = getReversedField(FieldColorModeId.ContinuousViridis, true);
    const calc = getFieldColorModeForField(field).getCalculator(field, theme);

    expect(calc(0, 0)).toBe('#fde725');
    expect(calc(0, 0.25)).toBe('#5ec962');
    expect(calc(0, 1)).toBe('#440154');
  });

  it('returns the registered scheme when reverse is unset or false', () => {
    const mode = fieldColorModeRegistry.get(FieldColorModeId.ContinuousGrYlRd);

    expect(getFieldColorModeForField(getReversedField(FieldColorModeId.ContinuousGrYlRd))).toBe(mode);
    expect(getFieldColorModeForField(getReversedField(FieldColorModeId.ContinuousGrYlRd, false))).toBe(mode);
  });

  it.each([
    { name: 'fixed', id: FieldColorModeId.Fixed },
    { name: 'thresholds', id: FieldColorModeId.Thresholds },
    { name: 'classic palette', id: FieldColorModeId.PaletteClassic },
  ])('ignores reverse for the $name mode', ({ id }) => {
    const mode = fieldColorModeRegistry.get(id);

    expect(isReversibleFieldColorMode(mode)).toBe(false);
    expect(getFieldColorMode(id, true)).toBe(mode);
  });

  it('reverses the scheme when the mode is looked up by id', () => {
    expect(getFieldColorMode(FieldColorModeId.ContinuousBlYlRd, true).getColors!(theme)).toEqual(
      ['dark-red', 'super-light-yellow', 'dark-blue'].map(theme.visualization.getColorByName)
    );
  });

  it('returns the same reversed scheme instance on every lookup', () => {
    expect(getFieldColorMode(FieldColorModeId.ContinuousGrYlRd, true)).toBe(
      getFieldColorMode(FieldColorModeId.ContinuousGrYlRd, true)
    );
  });
});

describe('color assignment', () => {
  const theme = createTheme();

  function seriesColor(mode: string, assignment: FieldColorAssignment | undefined, seriesIndex: number, name: string) {
    const field = getTestField(mode, undefined, name);
    field.state!.seriesIndex = seriesIndex;
    return getFieldColorMode(mode, false, assignment).getCalculator(field, theme)(0, 0);
  }

  it.each([
    { id: FieldColorModeId.PaletteClassic, expected: 'seriesIndex' },
    { id: FieldColorModeId.PaletteCategoricalNext, expected: 'seriesIndex' },
    { id: FieldColorModeId.PaletteClassicByName, expected: 'seriesName' },
    { id: FieldColorModeId.ContinuousViridis, expected: undefined },
    { id: FieldColorModeId.Thresholds, expected: undefined },
  ])('$id assigns colors by $expected by default', ({ id, expected }) => {
    expect(fieldColorModeRegistry.get(id).assignment).toBe(expected);
  });

  it('returns the palette itself when the assignment is its default', () => {
    const mode = fieldColorModeRegistry.get(FieldColorModeId.PaletteClassicByName);

    expect(getFieldColorMode(FieldColorModeId.PaletteClassicByName, false, 'seriesName')).toBe(mode);
  });

  it('assigns a palette by series name', () => {
    const mode = FieldColorModeId.PaletteCategoricalNext;

    expect(seriesColor(mode, 'seriesName', 0, 'cpu')).toBe(seriesColor(mode, 'seriesName', 5, 'cpu'));
    expect(seriesColor(mode, undefined, 0, 'cpu')).not.toBe(seriesColor(mode, undefined, 5, 'cpu'));
    expect(getFieldColorMode(mode, false, 'seriesName').useSeriesName).toBe(true);
  });

  it('assigns the by series name palette by series index', () => {
    const mode = FieldColorModeId.PaletteClassicByName;
    const colors = getFieldColorMode(mode).getColors!(theme);

    expect(seriesColor(mode, 'seriesIndex', 1, 'a')).toBe(colors[1]);
    expect(seriesColor(mode, 'seriesIndex', 1, 'b')).toBe(colors[1]);
    expect(getFieldColorMode(mode, false, 'seriesIndex').useSeriesName).toBe(false);
  });
});

describe('color by value', () => {
  const theme = createTheme();
  const versions = [
    '42974521621',
    '43142262336',
    '43360213011',
    '43819987164',
    '44038910387',
    '44259162873',
    '44480149990',
    '44693049476',
    '44730370174',
  ].map((v) => `13.4.0-${v}`);

  function getStringField(name: string, values: unknown[], mode: string = FieldColorModeId.PaletteClassic): Field {
    return { name, type: FieldType.string, values, config: { color: { mode, assignment: 'value' } }, state: {} };
  }

  function colorsOf(field: Field, t = theme): string[] {
    const display = getDisplayProcessor({ field, theme: t });
    return field.values.map((v) => display(v).color!);
  }

  it.each([FieldColorModeId.PaletteClassic, FieldColorModeId.PaletteCategoricalNext])(
    'gives the same value the same %s color regardless of field, order, or position',
    (mode) => {
      const [a1, b1] = colorsOf(getStringField('wave-1', [versions[0], versions[1]], mode));
      const [b2, a2] = colorsOf(getStringField('wave-2', [versions[1], versions[0]], mode));

      expect(a1).toBe(a2);
      expect(b1).toBe(b2);
      expect(a1).not.toBe(b1);
    }
  );

  it('picks colors from the selected palette', () => {
    const field = getStringField('v', versions, FieldColorModeId.PaletteCategoricalNext);
    const palette = getFieldColorPalette(field, theme)!;

    colorsOf(field).forEach((c) => expect(palette).toContain(c));
  });

  it('gives each of the sample deploy versions a distinct Categorical Next color', () => {
    const field = getStringField('v', versions, FieldColorModeId.PaletteCategoricalNext);

    expect(new Set(colorsOf(field)).size).toBe(versions.length);
  });

  it.each(['dark', 'light'] as const)(
    'adds visible darker shades to the categorical next palettes in the %s theme',
    (mode) => {
      const t = createTheme({ colors: { mode } });
      const base = getFieldColorMode(FieldColorModeId.PaletteCategoricalNext).getColors!(t);
      const byValue = getFieldColorMode(FieldColorModeId.PaletteCategoricalNext, false, 'value').getColors!(t);
      const shades = byValue.slice(base.length);

      expect(byValue.slice(0, base.length)).toEqual(base);
      expect(byValue.length).toBeGreaterThan(base.length * 2);
      expect(byValue.length).toBeLessThanOrEqual(base.length * 3);
      shades.forEach((c) =>
        expect(getContrastRatio(c, t.components.panel.background)).toBeGreaterThanOrEqual(t.colors.contrastThreshold)
      );
    }
  );

  it.each([
    FieldColorModeId.PaletteCategoricalNext,
    FieldColorModeId.PaletteCategoricalNext2,
    FieldColorModeId.PaletteCategoricalNext3,
  ])('preserves the hue of each %s color slot across themes', (id) => {
    for (const mode of ['dark', 'light'] as const) {
      const t = createTheme({ colors: { mode } });
      const base = getFieldColorMode(id).getColors!(t);
      const palette = getFieldColorMode(id, false, 'value').getColors!(t);

      expect(palette).toHaveLength(120);
      for (let i = 0; i < base.length; i++) {
        const shades = [palette[i], palette[i + 40], palette[i + 80]];
        expect(new Set(shades).size).toBe(3);
        for (const shade of shades.slice(1)) {
          expect(getContrastRatio(shade, t.components.panel.background)).toBeGreaterThanOrEqual(
            t.colors.contrastThreshold
          );
          // Hex quantization can shift the hue slightly, especially for low-saturation colors.
          expect(Math.abs(tinycolor(shade).toHsl().h - tinycolor(base[i]).toHsl().h)).toBeLessThan(1);
        }
      }
    }
  });

  it.each([FieldColorModeId.PaletteClassic, FieldColorModeId.PaletteColorblind])('keeps the %s palette as is', (id) => {
    expect(getFieldColorMode(id, false, 'value').getColors!(theme)).toEqual(getFieldColorMode(id).getColors!(theme));
  });

  it('lets value mappings override the hashed color', () => {
    const field = getStringField('v', ['pinned']);
    field.config.mappings = [{ type: MappingType.ValueToText, options: { pinned: { color: 'red' } } }];

    expect(colorsOf(field)).toEqual([theme.visualization.getColorByName('red')]);
  });

  it('colors numeric values by their value', () => {
    const field = { ...getStringField('v', [1, 2, 1]), type: FieldType.number };
    const [one, , oneAgain] = colorsOf(field);

    expect(one).toBe(oneAgain);
  });

  it('colors boolean values from the palette instead of green and red', () => {
    const field = {
      ...getStringField('v', [true, false], FieldColorModeId.PaletteCategoricalNext),
      type: FieldType.boolean,
    };
    const palette = getFieldColorPalette(field, theme)!;
    const [yes, no] = colorsOf(field);

    expect(palette).toContain(yes);
    expect(palette).toContain(no);
    expect(yes).not.toBe(no);
    expect(yes).toBe(colorsOf(getStringField('s', ['true'], FieldColorModeId.PaletteCategoricalNext))[0]);
  });

  it.each([
    { id: FieldColorModeId.PaletteClassic, expected: true },
    { id: FieldColorModeId.PaletteCategoricalNext3, expected: true },
    { id: FieldColorModeId.PaletteColorblind, expected: true },
    { id: FieldColorModeId.PaletteClassicByName, expected: true },
    { id: FieldColorModeId.ContinuousViridis, expected: false },
    { id: FieldColorModeId.Thresholds, expected: false },
    { id: FieldColorModeId.Fixed, expected: false },
  ])('supportsFieldColorAssignment($id) is $expected', ({ id, expected }) => {
    expect(supportsFieldColorAssignment(fieldColorModeRegistry.get(id))).toBe(expected);
  });

  it('ignores the assignment for modes that cannot assign colors', () => {
    const mode = fieldColorModeRegistry.get(FieldColorModeId.ContinuousViridis);

    expect(getFieldColorMode(FieldColorModeId.ContinuousViridis, false, 'value')).toBe(mode);
  });

  it('returns a cached by value mode that keeps the palette id and cannot be reversed', () => {
    const byValue = getFieldColorMode(FieldColorModeId.PaletteClassic, true, 'value');

    expect(byValue).toBe(getFieldColorMode(FieldColorModeId.PaletteClassic, false, 'value'));
    expect(byValue.id).toBe(FieldColorModeId.PaletteClassic);
    expect(byValue.isByValue).toBe(true);
    expect(isReversibleFieldColorMode(byValue)).toBe(false);
  });
});
