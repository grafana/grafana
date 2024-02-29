import { Field, FieldType } from '../types';

import { ArrayVector } from './ArrayVector';

// There's lots of @ts-expect-error here, because we actually expect it to be a typescript error
// to further encourge developers not to use ArrayVector

describe('ArrayVector', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
  });

  it('should init 150k with 65k Array.push() chonking', () => {
    const arr = Array.from({ length: 150e3 }, (v, i) => i);
    /// @ts-expect-error
    const av = new ArrayVector(arr);

    expect(av.toArray()).toEqual(arr);
  });

  it('should support add and push', () => {
    /// @ts-expect-error
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
      /// @ts-expect-error
      values: new ArrayVector(), // this defaults to `new ArrayVector<any>()`
    };
    expect(field).toBeDefined();

    // Before collapsing Vector, ReadWriteVector, and MutableVector these all worked fine

    /// @ts-expect-error
    field.values = new ArrayVector();
    /// @ts-expect-error
    field.values = new ArrayVector(undefined);
    /// @ts-expect-error
    field.values = new ArrayVector([1, 2, 3]);
    /// @ts-expect-error
    field.values = new ArrayVector([]);
    /// @ts-expect-error
    field.values = new ArrayVector([1, undefined]);
    /// @ts-expect-error
    field.values = new ArrayVector([null]);
    /// @ts-expect-error
    field.values = new ArrayVector(['a', 'b', 'c']);
    expect(field.values.length).toBe(3);
  });
});
