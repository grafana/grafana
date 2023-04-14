import { DataFrame, FieldType } from '@grafana/data';

import { getScalarDimension } from './scalar';

import { ScalarDimensionMode } from '.';

describe('scalar dimensions', () => {
  it('handles string field', () => {
    const values = ['-720', '10', '540', '90', '-210'];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: values,
          config: {
            min: -720,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalarDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalarDimensionMode.Clamped,
    });

    const clamped = frame.fields[0].values.map((k, i) => supplier.get(i));
    expect(clamped).toEqual([0, 0, 0, 0, 0]);
  });
  it('clamps out of range values', () => {
    const values = [-720, 10, 540, 90, -210];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: values,
          config: {
            min: -720,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalarDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalarDimensionMode.Clamped,
    });

    const clamped = frame.fields[0].values.map((k, i) => supplier.get(i));
    expect(clamped).toEqual([-360, 10, 360, 90, -210]);
  });

  it('keeps remainder after divisible by max', () => {
    const values = [-721, 10, 540, 390, -210];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: values,
          config: {
            min: -721,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalarDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalarDimensionMode.Mod,
    });

    const remainder = frame.fields[0].values.map((k, i) => supplier.get(i));
    expect(remainder).toEqual([-1, 10, 180, 30, -210]);
  });
});
