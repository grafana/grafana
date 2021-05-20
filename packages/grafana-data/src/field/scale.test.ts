import { ThresholdsMode, Field, FieldType } from '../types';
import { sortThresholds } from './thresholds';
import { ArrayVector } from '../vector/ArrayVector';
import { getScaleCalculator } from './scale';
import { createTheme } from '../themes';
import { getColorForTheme } from '../utils';

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
    expect(calc(true as any)).toEqual({
      percent: 1,
      color: getColorForTheme('green', theme.v1),
      threshold: undefined,
    });
    expect(calc(false as any)).toEqual({
      percent: 0,
      color: getColorForTheme('red', theme.v1),
      threshold: undefined,
    });
  });
});
