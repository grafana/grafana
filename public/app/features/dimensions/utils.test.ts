import { type DataFrame, type Field, FieldType, ReducerID, toDataFrame } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';

import { findField, findFieldIndex, getLastNotNullFieldValue, getScaleDimensionFromData } from './utils';

function makeFrame(fields: Array<Partial<Field> & { name: string; values: unknown[] }>): DataFrame {
  return toDataFrame({ fields });
}

describe('findFieldIndex / findField', () => {
  const frame = makeFrame([
    { name: 'time', type: FieldType.time, values: [1, 2] },
    { name: 'value', type: FieldType.number, values: [10, 20], config: { displayName: 'Temperature' } },
  ]);

  it('returns undefined for a missing frame or empty name', () => {
    expect(findFieldIndex('value', undefined)).toBeUndefined();
    expect(findFieldIndex('', frame)).toBeUndefined();
    expect(findFieldIndex(undefined, frame)).toBeUndefined();
  });

  it('matches by raw field name', () => {
    expect(findFieldIndex('time', frame)).toBe(0);
    expect(findFieldIndex('value', frame)).toBe(1);
  });

  it('matches by computed display name when the raw name does not match', () => {
    expect(findFieldIndex('Temperature', frame)).toBe(1);
  });

  it('returns undefined when nothing matches', () => {
    expect(findFieldIndex('missing', frame)).toBeUndefined();
  });

  it('findField returns the matching field or undefined', () => {
    expect(findField(frame, 'time')?.name).toBe('time');
    expect(findField(frame, 'missing')).toBeUndefined();
    expect(findField(undefined, 'time')).toBeUndefined();
  });
});

describe('getLastNotNullFieldValue', () => {
  it('prefers the precomputed lastNotNull reducer value', () => {
    const field: Field = {
      name: 'v',
      type: FieldType.number,
      config: {},
      values: [1, 2, 3],
      state: { calcs: { [ReducerID.lastNotNull]: 99 } },
    };
    expect(getLastNotNullFieldValue(field)).toBe(99);
  });

  it('scans from the end skipping trailing nulls when no calcs exist', () => {
    const field: Field = {
      name: 'v',
      type: FieldType.number,
      config: {},
      values: [1, 5, null, null],
    };
    expect(getLastNotNullFieldValue(field)).toBe(5);
  });

  it('returns undefined when every value is null', () => {
    const field: Field = {
      name: 'v',
      type: FieldType.number,
      config: {},
      values: [null, null],
    };
    expect(getLastNotNullFieldValue(field)).toBeUndefined();
  });
});

describe('getScaleDimensionFromData multi-series selection', () => {
  const cfg: ScaleDimensionConfig = { min: 0, max: 1, fixed: 0, field: 'v' };

  it('skips frames where the dimension is assumed and uses the first real match', () => {
    const withoutField = makeFrame([{ name: 'other', type: FieldType.number, values: [0, 1] }]);
    const withField = makeFrame([{ name: 'v', type: FieldType.number, values: [0, 10], config: { min: 0, max: 10 } }]);

    const dim = getScaleDimensionFromData({ series: [withoutField, withField] } as never, cfg);
    // resolved against the second frame: value 10 maps to the max of the 0..1 output range
    expect(dim.field?.name).toBe('v');
    expect(dim.get(1)).toBe(1);
  });

  it('falls back to a fixed (fieldless) dimension when no field is configured', () => {
    const dim = getScaleDimensionFromData({ series: [] } as never, { min: 0, max: 1, fixed: 0.5 });
    expect(dim.field).toBeUndefined();
    expect(dim.value()).toBe(0.5);
    expect(dim.get(0)).toBe(0.5);
  });
});
