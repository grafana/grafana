import { ArrayDataFrame } from '../dataframe/ArrayDataFrame';
import { toDataFrame } from '../dataframe/processDataFrame';
import { createTheme } from '../themes/createTheme';
import { Field, FieldType } from '../types/dataFrame';
import { FieldColorModeId } from '../types/fieldColor';
import { ThresholdsMode } from '../types/thresholds';

import { findNumericFieldMinMax, getScaleCalculator } from './scale';
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

describe('findNumericFieldMinMax', () => {
  it('find global min max', () => {
    const f0 = new ArrayDataFrame<{ title: string; value: number; value2: number | null }>([
      { title: 'AAA', value: 100, value2: 1234 },
      { title: 'BBB', value: -20, value2: null },
      { title: 'CCC', value: 200, value2: 1000 },
    ]);

    const minmax = findNumericFieldMinMax([f0]);
    expect(minmax.min).toEqual(-20);
    expect(minmax.max).toEqual(1234);
  });

  it('find global min max when all values are zero', () => {
    const f0 = new ArrayDataFrame<{ title: string; value: number; value2: number | null }>([
      { title: 'AAA', value: 0, value2: 0 },
      { title: 'CCC', value: 0, value2: 0 },
    ]);

    const minmax = findNumericFieldMinMax([f0]);
    expect(minmax.min).toEqual(0);
    expect(minmax.max).toEqual(0);
  });

  describe('when value is null', () => {
    it('then global min max should be null', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1] },
          { name: 'Value', type: FieldType.number, values: [null] },
        ],
      });
      const { min, max } = findNumericFieldMinMax([frame]);

      expect(min).toBe(null);
      expect(max).toBe(null);
    });
  });

  describe('when values are zero', () => {
    it('then global min max should be correct', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          { name: 'Value', type: FieldType.number, values: [1, 2] },
        ],
      });
      const frame2 = toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          { name: 'Value', type: FieldType.number, values: [0, 0] },
        ],
      });

      const { min, max } = findNumericFieldMinMax([frame, frame2]);

      expect(min).toBe(0);
      expect(max).toBe(2);
    });
  });
});
