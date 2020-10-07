import { ThresholdsMode, Field, FieldType, GrafanaThemeType, GrafanaTheme } from '../types';
import { sortThresholds } from './thresholds';
import { ArrayVector } from '../vector/ArrayVector';
import { getScaleCalculator } from './scale';

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

    const calc = getScaleCalculator(field, { type: GrafanaThemeType.Dark } as GrafanaTheme);
    expect(calc(70)).toEqual({
      percent: 0.7,
      threshold: thresholds[1],
      color: '#EAB839',
    });
  });
});
