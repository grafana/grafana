import { ThresholdsConfig, ThresholdsMode, FieldConfig, Threshold, Field, FieldType } from '../types';
import { ArrayVector } from '../vector/ArrayVector';

import { validateFieldConfig } from './fieldOverrides';
import { sortThresholds, getActiveThreshold, getActiveThresholdForValue } from './thresholds';

describe('thresholds', () => {
  test('sort thresholds', () => {
    const thresholds: ThresholdsConfig = {
      steps: [
        { color: 'TEN', value: 10 },
        { color: 'HHH', value: 100 },
        { color: 'ONE', value: 1 },
      ],
      mode: ThresholdsMode.Absolute,
    };
    const sorted = sortThresholds(thresholds.steps).map((t) => t.value);
    expect(sorted).toEqual([1, 10, 100]);
    const config: FieldConfig = { thresholds };

    // Mutates and sorts the
    validateFieldConfig(config);
    expect(getActiveThreshold(10, thresholds.steps).color).toEqual('TEN');
  });

  test('find active', () => {
    const thresholds: ThresholdsConfig = {
      steps: [
        { color: 'ONE', value: 1 },
        { color: 'TEN', value: 10 },
        { color: 'HHH', value: 100 },
      ],
      mode: ThresholdsMode.Absolute,
    };
    const config: FieldConfig = { thresholds };
    // Mutates and sets ONE to -Infinity
    validateFieldConfig(config);
    expect(getActiveThreshold(-1, thresholds.steps).color).toEqual('ONE');
    expect(getActiveThreshold(1, thresholds.steps).color).toEqual('ONE');
    expect(getActiveThreshold(5, thresholds.steps).color).toEqual('ONE');
    expect(getActiveThreshold(10, thresholds.steps).color).toEqual('TEN');
    expect(getActiveThreshold(11, thresholds.steps).color).toEqual('TEN');
    expect(getActiveThreshold(99, thresholds.steps).color).toEqual('TEN');
    expect(getActiveThreshold(100, thresholds.steps).color).toEqual('HHH');
    expect(getActiveThreshold(1000, thresholds.steps).color).toEqual('HHH');
  });

  function getThreshold(value: number, steps: Threshold[], mode: ThresholdsMode, percent = 1): Threshold {
    const field: Field = {
      name: 'test',
      config: { thresholds: { mode: mode, steps: sortThresholds(steps) } },
      type: FieldType.number,
      values: new ArrayVector([]),
    };
    validateFieldConfig(field.config!);
    return getActiveThresholdForValue(field, value, percent);
  }

  describe('Get color from threshold', () => {
    it('should get first threshold color when only one threshold', () => {
      const thresholds = [{ index: 0, value: -Infinity, color: '#7EB26D' }];
      expect(getThreshold(49, thresholds, ThresholdsMode.Absolute)).toEqual(thresholds[0]);
    });

    it('should get the threshold color if value is same as a threshold', () => {
      const thresholds = [
        { index: 0, value: -Infinity, color: '#7EB26D' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ];
      expect(getThreshold(50, thresholds, ThresholdsMode.Absolute)).toEqual(thresholds[1]);
    });

    it('should get the nearest threshold color between thresholds', () => {
      const thresholds = [
        { index: 0, value: -Infinity, color: '#7EB26D' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ];
      expect(getThreshold(55, thresholds, ThresholdsMode.Absolute)).toEqual(thresholds[1]);
    });

    it('should be able to get percent based threshold', () => {
      const thresholds = [
        { index: 0, value: 0, color: '#7EB26D' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ];
      expect(getThreshold(55, thresholds, ThresholdsMode.Percentage, 0.9)).toEqual(thresholds[2]);
      expect(getThreshold(55, thresholds, ThresholdsMode.Percentage, 0.5)).toEqual(thresholds[1]);
      expect(getThreshold(55, thresholds, ThresholdsMode.Percentage, 0.2)).toEqual(thresholds[0]);
    });
  });
});
