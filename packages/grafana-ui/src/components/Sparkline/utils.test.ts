import { Field, FieldSparkline, FieldType } from '@grafana/data';

import { getYRange, preparePlotFrame } from './utils';

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
      description: 'straight line',
      field: straightLineYField,
      expected: [0, 4],
    },
    {
      description: 'straight line, negative values',
      field: straightLineNegYField,
      expected: [-4, 0],
    },
    {
      description: 'straight line with config min and max',
      field: { ...straightLineYField, config: { min: 1, max: 3 }, state: { range: { min: 1, max: 3, delta: 2 } } },
      expected: [1, 3],
    },
  ])(`should return correct range for $description`, ({ field, expected }) => {
    const actual = getYRange(field, getAlignedFrame(field));
    expect(actual).toEqual(expected);
    expect(actual[0]).toBeLessThan(actual[1]!);
  });
});
