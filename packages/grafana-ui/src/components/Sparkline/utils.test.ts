import { createTheme, Field, FieldSparkline, FieldType, toDataFrame } from '@grafana/data';

import { getYRange, prepareConfig, preparePlotFrame } from './utils';

describe('Prepare Sparkline plot frame', () => {
  it('should return sorted array if x-axis numeric', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [5, 4, 3, 2, 1],
        type: FieldType.number,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1, 2, 3, 4, 5]);
    expect(frame.fields[1].values).toEqual([5, 4, 3, 2, 1]);
  });

  it('should return a dataframe with unmodified fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000]);
    expect(frame.fields[1].values).toEqual([1, 2, 3, 4, 5]);
  });

  it('should return a dataframe with sorted fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1682258400000, 1681653600000, 1681048800000, 1680444000000, 1679839200000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000]);
    expect(frame.fields[1].values).toEqual([5, 4, 3, 2, 1]);
  });

  it('should return a dataframe with null thresholds applied to sorted fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [7, 2, 4],
        type: FieldType.time,
        config: { interval: 1 },
      },
      y: {
        name: 'y',
        values: [1, 2, 3],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([2, 3, 4, 5, 6, 7]);
    expect(frame.fields[1].values).toEqual([2, null, 3, null, null, 1]);
  });
});

describe('Get y range', () => {
  const defaultYField: Field = {
    name: 'y',
    values: [1, 2, 3, 4, 5],
    type: FieldType.number,
    config: {},
    state: { range: { min: 1, max: 5, delta: 4 } },
  };
  const straightLineYField: Field = {
    name: 'y',
    values: [2, 2, 2, 2, 2],
    type: FieldType.number,
    config: {},
    state: { range: { min: 2, max: 2, delta: 0 } },
  };
  const straightLineNegYField: Field = {
    name: 'y',
    values: [-2, -2, -2, -2, -2],
    type: FieldType.number,
    config: {},
    state: { range: { min: -2, max: -2, delta: 0 } },
  };
  const decimalsCloseYField: Field = {
    name: 'y',
    values: [2, 1.999999999999999, 2.000000000000001, 2, 2],
    type: FieldType.number,
    config: {},
    state: { range: { min: 1.9999999999999999999, max: 2.000000000000000001, delta: 0 } },
  };
  const decimalsNotCloseYField: Field = {
    name: 'y',
    values: [2, 0.0094, 0.0053, 0.0078, 0.0061],
    type: FieldType.number,
    config: {},
    state: { range: { min: 0.0053, max: 0.0094, delta: 0.0041 } },
  };
  const xField: Field = {
    name: 'x',
    values: [1000, 2000, 3000, 4000, 5000],
    type: FieldType.time,
    config: {},
  };
  const getAlignedFrame = (yField: Field) => ({
    refId: 'sparkline',
    fields: [xField, yField],
    length: yField.values.length,
  });
  it.each([
    {
      description: 'inferred min and max',
      field: defaultYField,
      expected: [1, 5],
    },
    {
      description: 'min from config',
      field: { ...defaultYField, config: { min: 3 }, state: { range: { min: 3, max: 5, delta: 2 } } },
      expected: [3, 5],
    },
    {
      description: 'max from config',
      field: { ...defaultYField, config: { max: 30 }, state: { range: { min: 1, max: 30, delta: 29 } } },
      expected: [1, 30],
    },
    {
      description: 'no value is set',
      field: { ...defaultYField, config: { noValue: '0' } },
      expected: [0, 5],
    },
    {
      description: 'NaN no value is set',
      field: { ...defaultYField, config: { noValue: 'foo' } },
      expected: [1, 5],
    },
    {
      description: 'straight line',
      field: straightLineYField,
      expected: [2, 4],
    },
    {
      description: 'straight line, negative values',
      field: straightLineNegYField,
      expected: [-4, -2],
    },
    {
      description: 'straight line with config min and max',
      field: { ...straightLineYField, config: { min: 1, max: 3 }, state: { range: { min: 1, max: 3, delta: 2 } } },
      expected: [1, 3],
    },
    {
      description: 'straight line with config no value',
      field: { ...straightLineYField, config: { noValue: '0' } },
      expected: [0, 2],
    },
    {
      description: 'long decimals which are nearly equal and result in a functional delta of 0',
      field: decimalsCloseYField,
      expected: [2, 4],
    },
    {
      description: 'decimal values which are not close to equal should not be rounded out',
      field: decimalsNotCloseYField,
      expected: [0.0053, 0.0094],
    },
  ])(`should return correct range for $description`, ({ field, expected }) => {
    const actual = getYRange(getAlignedFrame(field));
    expect(actual).toEqual(expected);
    expect(actual[0]).toBeLessThan(actual[1]!);
  });
});

describe('prepareConfig', () => {
  it('should not throw an error if there are multiple values', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const dataFrame = toDataFrame({
      fields: [sparkline.x, sparkline.y],
    });

    const config = prepareConfig(sparkline, dataFrame, createTheme());
    expect(config.series.length).toBe(1);
  });

  it('should not throw an error if there is a single value', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1],
        type: FieldType.number,
        config: {},
      },
    };

    const dataFrame = toDataFrame({
      fields: [sparkline.x, sparkline.y],
    });

    const config = prepareConfig(sparkline, dataFrame, createTheme());
    expect(config.series.length).toBe(1);
  });

  it('should not throw an error if there are no values', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [],
        type: FieldType.number,
        config: {},
      },
    };

    const dataFrame = toDataFrame({
      fields: [sparkline.x, sparkline.y],
    });

    const config = prepareConfig(sparkline, dataFrame, createTheme());
    expect(config.series.length).toBe(1);
  });

  it('should set up highlight series if showHighlights is true and highlightIdx exists', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
      highlightIndex: 2,
    };

    const dataFrame = toDataFrame({
      fields: [sparkline.x, sparkline.y],
    });

    const config = prepareConfig(sparkline, dataFrame, createTheme(), true);
    expect(config.series.length).toBe(1);
    expect(config.series[0].getConfig().points).toEqual(
      expect.objectContaining({
        show: true,
        filter: [2],
      })
    );
  });

  it('should not set up highlight series if showHighlights is false even if highlightIdx exists', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
      highlightIndex: 2,
    };

    const dataFrame = toDataFrame({
      fields: [sparkline.x, sparkline.y],
    });

    const config = prepareConfig(sparkline, dataFrame, createTheme(), false);
    expect(config.series.length).toBe(1);
    expect(config.series[0].getConfig().points?.show).not.toBe(true);
  });
});
