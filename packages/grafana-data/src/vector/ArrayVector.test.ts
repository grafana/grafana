import { Field, FieldType } from '../types';

import { ArrayVector } from './ArrayVector';

describe('ArrayVector', () => {
  it('should init 150k with 65k Array.push() chonking', () => {
    const arr = Array.from({ length: 150e3 }, (v, i) => i);
    const av = new ArrayVector(arr);

    expect(av.toArray()).toEqual(arr);
  });

  it('should support add and push', () => {
    const av = new ArrayVector<number>();
    av.add(1);
    av.push(2);
    av.push(3, 4);

    expect(av.toArray()).toEqual([1, 2, 3, 4]);
  });

  it('typescript should not re-define the ArrayVector<T> based on input to the constructor', () => {
    const field: Field<number> = {
      name: 'test',
      config: {},
      type: FieldType.number,
      values: new ArrayVector(), // this defaults to `new ArrayVector<any>()`
    };
    expect(field).toBeDefined();

    // Before collapsing Vector, ReadWriteVector, and MutableVector these all worked fine
    field.values = new ArrayVector();
    field.values = new ArrayVector(undefined);
    field.values = new ArrayVector([1, 2, 3]);
    field.values = new ArrayVector([1, undefined]);
    field.values = new ArrayVector([null]);
    field.values = new ArrayVector(['a', 'b', 'c']);
    expect(field.values.length).toBe(3);
  });
});
