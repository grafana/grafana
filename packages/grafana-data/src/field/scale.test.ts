import { createTheme } from '../themes/createTheme';
import { type Field, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';
import { ThresholdsMode } from '../types/thresholds';

import { fieldColorModeRegistry, type FieldValueColorCalculator } from './fieldColor';
import { getFieldSeriesColor, getScaleCalculator } from './scale';
import { sortThresholds } from './thresholds';

describe('getScaleCalculator', () => {
  it('should return percent, threshold and color', () => {
    const thresholds = [
      { index: 2, value: 75, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ];

    const field: Field = {
      name: 'test',
      config: { thresholds: { mode: ThresholdsMode.Absolute, steps: sortThresholds(thresholds) } },
      type: FieldType.number,
      values: [0, 50, 100],
    };

    const calc = getScaleCalculator(field, createTheme());
    expect(calc(70)).toEqual({
      percent: 0.7,
      threshold: thresholds[1],
      color: '#EAB839',
    });
  });

  it('reasonable boolean values', () => {
    const field: Field = {
      name: 'test',
      config: {},
      type: FieldType.boolean,
      values: [true, false, true],
    };

    const theme = createTheme();
    const calc = getScaleCalculator(field, theme);
    expect(calc(true as unknown as number)).toEqual({
      percent: 1,
      color: theme.visualization.getColorByName('green'),
      threshold: undefined,
    });
    expect(calc(false as unknown as number)).toEqual({
      percent: 0,
      color: theme.visualization.getColorByName('red'),
      threshold: undefined,
    });
  });

  it('should handle min = max', () => {
    const field: Field = {
      name: 'test',
      config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
      type: FieldType.number,
      values: [1],
    };

    const theme = createTheme();
    const calc = getScaleCalculator(field, theme);

    expect(calc(1).color).toEqual('rgb(115, 191, 105)');
  });
});

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

describe('getFieldSeriesColor', () => {
  const field = getTestField('continuous-GrYlRd');
  field.values = [0, -10, 5, 10, 2, 5];

  it('When color.seriesBy is last use that to calc series color', () => {
    field.config.color!.seriesBy = 'last';
    const color = getFieldSeriesColor(field, createTheme());
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });

    // the 4 can be anything, 0.75 comes from 5 being 75% in the range -10 to 10 (see data above)
    expect(color.color).toEqual(calcFn(4, 0.75));
  });

  it('When color.seriesBy is max use that to calc series color', () => {
    field.config.color!.seriesBy = 'max';
    const color = getFieldSeriesColor(field, createTheme());
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });

    expect(color.color).toEqual(calcFn(10, 1));
  });

  it('When color.seriesBy is min use that to calc series color', () => {
    field.config.color!.seriesBy = 'min';
    const color = getFieldSeriesColor(field, createTheme());
    const calcFn = getCalculator({ mode: 'continuous-GrYlRd' });

    expect(color.color).toEqual(calcFn(-10, 0));
  });
});
