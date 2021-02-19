import { Field, FieldType, ColorScheme, ThresholdsConfig, ThresholdsMode, FieldColorMode, FieldConfig } from '../types';
import { sortThresholds, getScaleCalculator, getActiveThreshold } from './scale';
import { ArrayVector } from '../vector';
import { validateFieldConfig } from './fieldOverrides';

describe('scale', () => {
  test('sort thresholds', () => {
    const thresholds: ThresholdsConfig = {
      steps: [
        { color: 'TEN', value: 10 },
        { color: 'HHH', value: 100 },
        { color: 'ONE', value: 1 },
      ],
      mode: ThresholdsMode.Absolute,
    };
    const sorted = sortThresholds(thresholds.steps).map(t => t.value);
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

  test('absolute thresholds', () => {
    const thresholds: ThresholdsConfig = {
      steps: [
        // Colors are ignored when 'scheme' exists
        { color: '#F00', state: 'LowLow', value: -Infinity },
        { color: '#F00', state: 'Low', value: -50 },
        { color: '#F00', state: 'OK', value: 0 },
        { color: '#F00', state: 'High', value: 50 },
        { color: '#F00', state: 'HighHigh', value: 100 },
      ],
      mode: ThresholdsMode.Absolute,
    };

    const field: Field<number> = {
      name: 'test',
      type: FieldType.number,
      config: {
        min: -100, // explicit range
        max: 100, // note less then range of actual data
        thresholds,
        color: {
          mode: FieldColorMode.Scheme,
          schemeName: ColorScheme.Greens,
        },
      },
      values: new ArrayVector([
        -1000,
        -100,
        -75,
        -50,
        -25,
        0, // middle
        25,
        50,
        75,
        100,
        1000,
      ]),
    };
    validateFieldConfig(field.config);
    const calc = getScaleCalculator(field);
    const mapped = field.values.toArray().map(v => {
      return calc(v);
    });
    expect(mapped).toMatchInlineSnapshot(`
      Array [
        Object {
          "color": "rgb(247, 252, 245)",
          "percent": -4.5,
          "threshold": Object {
            "color": "#F00",
            "state": "LowLow",
            "value": -Infinity,
          },
        },
        Object {
          "color": "rgb(247, 252, 245)",
          "percent": 0,
          "threshold": Object {
            "color": "#F00",
            "state": "LowLow",
            "value": -Infinity,
          },
        },
        Object {
          "color": "rgb(227, 244, 222)",
          "percent": 0.125,
          "threshold": Object {
            "color": "#F00",
            "state": "LowLow",
            "value": -Infinity,
          },
        },
        Object {
          "color": "rgb(198, 232, 191)",
          "percent": 0.25,
          "threshold": Object {
            "color": "#F00",
            "state": "Low",
            "value": -50,
          },
        },
        Object {
          "color": "rgb(160, 216, 155)",
          "percent": 0.375,
          "threshold": Object {
            "color": "#F00",
            "state": "Low",
            "value": -50,
          },
        },
        Object {
          "color": "rgb(115, 195, 120)",
          "percent": 0.5,
          "threshold": Object {
            "color": "#F00",
            "state": "OK",
            "value": 0,
          },
        },
        Object {
          "color": "rgb(69, 170, 93)",
          "percent": 0.625,
          "threshold": Object {
            "color": "#F00",
            "state": "OK",
            "value": 0,
          },
        },
        Object {
          "color": "rgb(34, 139, 69)",
          "percent": 0.75,
          "threshold": Object {
            "color": "#F00",
            "state": "High",
            "value": 50,
          },
        },
        Object {
          "color": "rgb(6, 107, 45)",
          "percent": 0.875,
          "threshold": Object {
            "color": "#F00",
            "state": "High",
            "value": 50,
          },
        },
        Object {
          "color": "rgb(0, 68, 27)",
          "percent": 1,
          "threshold": Object {
            "color": "#F00",
            "state": "HighHigh",
            "value": 100,
          },
        },
        Object {
          "color": "rgb(0, 68, 27)",
          "percent": 5.5,
          "threshold": Object {
            "color": "#F00",
            "state": "HighHigh",
            "value": 100,
          },
        },
      ]
    `);
  });
});
