import { type DataFrame, FieldType } from '@grafana/data/dataframe';

import { appendFrame } from './utils';

function makeField(name: string, values: unknown[], type = FieldType.string) {
  return { name, type, config: {}, values };
}

function makeFrame(fields: Array<{ name: string; values: unknown[]; type?: FieldType }>, length?: number): DataFrame {
  const f = fields.map(({ name, values, type }) => makeField(name, values, type));
  return { fields: f, length: length ?? (f[0]?.values.length || 0) };
}

describe('appendFrame', () => {
  it('should append frames with identical fields', () => {
    const target = makeFrame([
      { name: 'a', values: [1, 2] },
      { name: 'b', values: ['x', 'y'] },
    ]);
    const frame = makeFrame([
      { name: 'a', values: [3] },
      { name: 'b', values: ['z'] },
    ]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual(['x', 'y', 'z']);
  });

  it('should backfill new fields with null for existing rows', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([
      { name: 'a', values: [3] },
      { name: 'b', values: ['new'] },
    ]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, null, 'new']);
  });

  it('should pad missing fields with null for new rows', () => {
    const target = makeFrame([
      { name: 'a', values: [1, 2] },
      { name: 'b', values: ['x', 'y'] },
    ]);
    const frame = makeFrame([{ name: 'a', values: [3] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual(['x', 'y', null]);
  });

  it('should handle completely disjoint fields', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([{ name: 'b', values: ['x'] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, null]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, null, 'x']);
  });

  it('should handle multiple appends with varying fields', () => {
    const target = makeFrame([{ name: 'a', values: [1] }]);

    // Second page introduces field 'b'
    appendFrame(
      target,
      makeFrame([
        { name: 'a', values: [2] },
        { name: 'b', values: ['x'] },
      ])
    );
    expect(target.length).toBe(2);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, 'x']);

    // Third page introduces field 'c', drops 'b'
    appendFrame(
      target,
      makeFrame([
        { name: 'a', values: [3] },
        { name: 'c', values: [true] },
      ])
    );
    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, 'x', null]);
    expect(target.fields.find((f) => f.name === 'c')?.values).toEqual([null, null, true]);
  });

  it('should handle appending an empty frame', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([], 0);

    appendFrame(target, frame);

    expect(target.length).toBe(2);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2]);
  });

  it('should handle appending to an empty target', () => {
    const target = makeFrame([], 0);
    const frame = makeFrame([{ name: 'a', values: [1] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(1);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1]);
  });
});
