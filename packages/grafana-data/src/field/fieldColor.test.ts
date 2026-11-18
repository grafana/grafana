import { createTheme } from '../themes/createTheme';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';

import {
  fieldColorModeRegistry,
  getFieldColorMode,
  getFieldColorModeForField,
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
