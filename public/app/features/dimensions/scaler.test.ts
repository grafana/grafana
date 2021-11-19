import { ArrayVector, DataFrame, FieldType } from '@grafana/data';
import { ScalerDimensionMode } from '.';
import { getScalerDimension } from './scaler';

describe('scaler dimensions', () => {
  it('handles string field', () => {
    const values = ['-720', '10', '540', '90', '-210'];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: new ArrayVector(values),
          config: {
            min: -720,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalerDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalerDimensionMode.Capped,
    });

    const capped = frame.fields[0].values.toArray().map((k, i) => supplier.get(i));
    expect(capped).toEqual([0, 0, 0, 0, 0]);
  });
  it('caps out of range values', () => {
    const values = [-720, 10, 540, 90, -210];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: new ArrayVector(values),
          config: {
            min: -720,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalerDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalerDimensionMode.Capped,
    });

    const capped = frame.fields[0].values.toArray().map((k, i) => supplier.get(i));
    expect(capped).toEqual([-360, 10, 360, 90, -210]);
  });

  it('keeps remainder after divisible by max', () => {
    const values = [-720, 10, 540, 90, -210];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        {
          name: 'test',
          type: FieldType.number,
          values: new ArrayVector(values),
          config: {
            min: -720,
            max: 540,
          },
        },
      ],
    };

    const supplier = getScalerDimension(frame, {
      min: -360,
      max: 360,
      field: 'test',
      fixed: 0,
      mode: ScalerDimensionMode.Mod,
    });

    const remainder = frame.fields[0].values.toArray().map((k, i) => supplier.get(i));
    expect(remainder).toEqual([-360, 10, 360, 90, -210]);
  });
});
