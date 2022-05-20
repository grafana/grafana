import { FieldColorModeId, FieldConfig, ThresholdsMode } from '@grafana/data';

import { getTheme } from '../../themes';

import { getFormattedThresholds } from './utils';

describe('getFormattedThresholds', () => {
  const value = {
    text: '25',
    numeric: 25,
  };
  const theme = getTheme();
  let field: FieldConfig;

  beforeEach(() => {
    field = {
      min: 0,
      max: 100,
      color: {
        mode: FieldColorModeId.Thresholds,
      },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [{ value: -Infinity, color: '#7EB26D' }],
      },
    };
  });

  it('should return first thresholds color for min and max', () => {
    field.thresholds = { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: '#7EB26D' }] };

    expect(getFormattedThresholds(2, field, value, theme)).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 100, color: '#7EB26D' },
    ]);
  });

  it('should get the correct formatted values when thresholds are added', () => {
    field.thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 50, color: '#EAB839' },
        { value: 75, color: '#6ED0E0' },
      ],
    };

    expect(getFormattedThresholds(2, field, value, theme)).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 50, color: '#7EB26D' },
      { value: 75, color: '#EAB839' },
      { value: 100, color: '#6ED0E0' },
    ]);
  });
});
