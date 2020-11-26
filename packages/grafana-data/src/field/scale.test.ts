import { ThresholdsMode, Field, FieldType } from '../types';
import { sortThresholds } from './thresholds';
import { ArrayVector } from '../vector/ArrayVector';
import { findNumericFieldMinMax, getScaleCalculator } from './scale';
import { getTestTheme } from '../utils/testdata/testTheme';
import { ArrayDataFrame, toDataFrame } from '../dataframe';

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

    const calc = getScaleCalculator(field, getTestTheme());
    expect(calc(70)).toEqual({
      percent: 0.7,
      threshold: thresholds[1],
      color: '#EAB839',
    });
  });
});

describe('Global MinMax', () => {
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

  describe('when value values are zeo', () => {
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
