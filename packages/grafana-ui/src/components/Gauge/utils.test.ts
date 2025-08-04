import { FieldColorModeId, FieldConfig, ThresholdsMode } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';

import { getTheme } from '../../themes/getTheme';

import { calculateGaugeAutoProps, getFormattedThresholds } from './utils';

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

describe('calculateGaugeAutoProps', () => {
  it('should calculate gauge properties correctly when title is undefined', () => {
    const width = 200;
    const height = 300;
    const orientation = VizOrientation.Horizontal;
    const title = undefined;

    const result = calculateGaugeAutoProps(width, height, title, orientation);

    expect(result.showLabel).toBe(false);
    expect(result.gaugeHeight).toBe(200);
    expect(result.titleFontSize).toBe(20);
  });

  it('should calculate gauge properties correctly when title is defined', () => {
    const width = 200;
    const height = 300;
    const orientation = VizOrientation.Vertical;
    const title = 'My Gauge';

    const result = calculateGaugeAutoProps(width, height, title, orientation);

    expect(result.showLabel).toBe(true);
    expect(result.gaugeHeight).toBe(200);
    expect(result.titleFontSize).toBe(20);
  });

  it('should calculate gauge properties correctly for vertical and horizontal orientations', () => {
    const width = 100;
    const height = 150;
    const title = 'My Gauge';

    // Test for vertical orientation
    const verticalResult = calculateGaugeAutoProps(width, height, title, VizOrientation.Vertical);
    expect(verticalResult.showLabel).toBe(true);
    expect(verticalResult.gaugeHeight).toBe(100);
    expect(verticalResult.titleFontSize).toBe(15);

    // Test for horizontal orientation
    const horizontalResult = calculateGaugeAutoProps(width, height, title, VizOrientation.Horizontal);
    expect(horizontalResult.showLabel).toBe(true);
    expect(horizontalResult.gaugeHeight).toBe(100);
    expect(horizontalResult.titleFontSize).toBe(10);
  });
});
