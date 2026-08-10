import { type Field, FieldType } from '@grafana/data';

import { buildHeaderDistribution, getHeaderDistribution } from './headerVisualizations';

function makeField(type: FieldType, values: unknown[]): Field {
  return { name: 'value', type, values, config: {} };
}

describe('buildHeaderDistribution', () => {
  it('builds a bounded numeric histogram from finite values', () => {
    const distribution = buildHeaderDistribution(makeField(FieldType.number, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));

    expect(distribution).toEqual({
      kind: 'histogram',
      x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      min: 0,
      max: 11,
      nullCount: 0,
      invalidCount: 0,
      totalCount: 12,
    });
  });

  it('routes time values to a histogram and tracks null and invalid values', () => {
    const distribution = buildHeaderDistribution(
      makeField(FieldType.time, [new Date(1000), 2000, null, Number.NaN, 'invalid'])
    );

    expect(distribution).toEqual({
      kind: 'histogram',
      x: [1000, 2000],
      counts: [1, 1],
      min: 1000,
      max: 2000,
      nullCount: 1,
      invalidCount: 2,
      totalCount: 5,
    });
  });

  it.each([
    { type: FieldType.string, values: ['a', 'a', 'b'] },
    { type: FieldType.enum, values: ['a', 'a', 'b'] },
    { type: FieldType.boolean, values: [true, true, false] },
  ])('builds category segments for $type fields', ({ type, values }) => {
    expect(buildHeaderDistribution(makeField(type, values))).toEqual({
      kind: 'categories',
      segments: [
        { label: String(values[0]), count: 2, type: 'value' },
        { label: String(values[2]), count: 1, type: 'value' },
      ],
      totalCount: 3,
    });
  });

  it('keeps the top categories and combines the remainder as Other', () => {
    expect(buildHeaderDistribution(makeField(FieldType.string, ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']))).toEqual({
      kind: 'categories',
      segments: [
        { label: 'a', count: 2, type: 'value' },
        { label: 'b', count: 1, type: 'value' },
        { label: 'c', count: 1, type: 'value' },
        { label: 'd', count: 1, type: 'value' },
        { label: 'e', count: 1, type: 'value' },
        { label: 'Other', count: 2, type: 'other' },
      ],
      totalCount: 8,
    });
  });

  it('adds a neutral null segment to categorical distributions', () => {
    expect(buildHeaderDistribution(makeField(FieldType.string, ['a', null, undefined]))).toEqual({
      kind: 'categories',
      segments: [
        { label: 'a', count: 1, type: 'value' },
        { label: 'Null', count: 2, type: 'null' },
      ],
      totalCount: 3,
    });
  });

  it.each([
    makeField(FieldType.number, []),
    makeField(FieldType.number, [null, Number.NaN]),
    makeField(FieldType.string, []),
    makeField(FieldType.other, [1, 2, 3]),
  ])('returns no distribution for empty or unsupported fields', (field) => {
    expect(buildHeaderDistribution(field)).toBeUndefined();
  });

  it('memoizes distributions by field type and values identity', () => {
    const values = [1, 2, 3];
    const first = getHeaderDistribution(makeField(FieldType.number, values));
    const second = getHeaderDistribution(makeField(FieldType.number, values));

    expect(second).toBe(first);
  });
});
