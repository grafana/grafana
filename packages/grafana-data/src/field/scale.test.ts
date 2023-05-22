import { createTheme } from '../themes';
import { ThresholdsMode, Field, FieldType, FieldColorModeId } from '../types';
import { ArrayVector } from '../vector/ArrayVector';

import { getScaleCalculator } from './scale';
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
      values: new ArrayVector([0, 50, 100]),
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
      values: new ArrayVector([true, false, true]),
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
      values: new ArrayVector([1]),
    };

    const theme = createTheme();
    const calc = getScaleCalculator(field, theme);

    expect(calc(1).color).toEqual('rgb(115, 191, 105)');
  });
});
