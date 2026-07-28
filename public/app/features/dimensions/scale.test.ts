import { type DataFrame, FieldType } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';

import { getScaledDimension, validateScaleConfig, validateScaleOptions } from './scale';

describe('scale dimensions', () => {
  it('should validate empty input', () => {
    const out = validateScaleConfig({} as ScaleDimensionConfig, {
      min: 5,
      max: 10,
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "fixed": 7.5,
        "max": 10,
        "min": 5,
      }
    `);
  });

  it('should assert min<max', () => {
    const out = validateScaleConfig(
      {
        max: -3,
        min: 7,
        fixed: 100,
      },
      {
        min: 5,
        max: 10,
      }
    );
    expect(out).toMatchInlineSnapshot(`
      {
        "fixed": 10,
        "max": 7,
        "min": 5,
      }
    `);
  });

  it('should support negative min values', () => {
    const values = [-20, -10, -5, 0, 5, 10, 20];
    const frame: DataFrame = {
      name: 'a',
      length: values.length,
      fields: [
        { name: 'time', type: FieldType.number, values: values, config: {} },
        {
          name: 'hello',
          type: FieldType.number,
          values: values,
          config: {
            min: -10,
            max: 10,
          },
        },
      ],
    };

    const supplier = getScaledDimension(frame, {
      min: -1,
      max: 1,
      field: 'hello',
      fixed: 0,
    });
    const scaled = frame.fields[0].values.map((k, i) => supplier.get(i));
    expect(scaled).toEqual([-1, -1, -0.5, 0, 0.5, 1, 1]);
  });

  it('returns the fixed value (assumed) when the field is not found', () => {
    const supplier = getScaledDimension(undefined, { min: 0, max: 1, fixed: 4, field: 'missing' });
    expect(supplier.get(0)).toBe(4);
    expect(supplier.value()).toBe(4);
    expect(supplier.isAssumed).toBe(true);
  });

  it('clamps to config.min when the field has no value range', () => {
    const frame: DataFrame = {
      name: 'a',
      length: 3,
      fields: [{ name: 'flat', type: FieldType.number, values: [5, 5, 5], config: {} }],
    };
    const supplier = getScaledDimension(frame, { min: 2, max: 10, field: 'flat', fixed: 0 });
    // info.delta === 0 -> every index resolves to the configured min
    expect([supplier.get(0), supplier.get(1)]).toEqual([2, 2]);
  });

  it('value() resolves the dimension at the last non-null entry', () => {
    const frame: DataFrame = {
      name: 'a',
      length: 2,
      fields: [{ name: 'v', type: FieldType.number, values: [0, 1], config: { min: 0, max: 1 } }],
    };
    const supplier = getScaledDimension(frame, { min: 0, max: 100, field: 'v', fixed: 0 });
    // last non-null entry (1) is the field max -> top of the 0..100 output range
    expect(supplier.value()).toBe(100);
    expect(supplier.get(0)).toBe(0);
  });
});

describe('validateScaleOptions', () => {
  it('defaults to the full 0..1 range when nothing is provided', () => {
    expect(validateScaleOptions(undefined)).toEqual({ min: 0, max: 1 });
  });

  it('fills in only the missing bounds', () => {
    expect(validateScaleOptions({ min: 3 } as never)).toEqual({ min: 3, max: 1 });
    expect(validateScaleOptions({ max: 7 } as never)).toEqual({ min: 0, max: 7 });
  });
});
