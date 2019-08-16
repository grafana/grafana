import { ConstantVector, ScaledVector, ArrayVector, CircularVector, AppendedVectors } from './vector';

describe('Check Proxy Vector', () => {
  it('should support constant values', () => {
    const value = 3.5;
    const v = new ConstantVector(value, 7);
    expect(v.length).toEqual(7);

    expect(v.get(0)).toEqual(value);
    expect(v.get(1)).toEqual(value);

    // Now check all of them
    for (let i = 0; i < 10; i++) {
      expect(v.get(i)).toEqual(value);
    }
  });

  it('should support multiply operations', () => {
    const source = new ArrayVector([1, 2, 3, 4]);
    const scale = 2.456;
    const v = new ScaledVector(source, scale);
    expect(v.length).toEqual(source.length);
    //  expect(v.push(10)).toEqual(source.length); // not implemented
    for (let i = 0; i < 10; i++) {
      expect(v.get(i)).toEqual(source.get(i) * scale);
    }
  });
});

describe('Check Circular Vector', () => {
  it('should support constant values', () => {
    const buffer = [3, 2, 1, 0];
    const v = new CircularVector(buffer);
    expect(v.length).toEqual(4);
    expect(v.toJSON()).toEqual([3, 2, 1, 0]);

    v.append(4);
    expect(v.toJSON()).toEqual([4, 3, 2, 1]);

    v.append(5);
    expect(v.toJSON()).toEqual([5, 4, 3, 2]);
  });
});

describe('Check Appending Vector', () => {
  it('should transparently join them', () => {
    const appended = new AppendedVectors();
    appended.append(new ArrayVector([1, 2, 3]));
    appended.append(new ArrayVector([4, 5, 6]));
    appended.append(new ArrayVector([7, 8, 9]));
    expect(appended.length).toEqual(9);

    appended.setLength(5);
    expect(appended.length).toEqual(5);
    appended.append(new ArrayVector(['a', 'b', 'c']));
    expect(appended.length).toEqual(8);
    expect(appended.toArray()).toEqual([1, 2, 3, 4, 5, 'a', 'b', 'c']);

    appended.setLength(2);
    appended.setLength(6);
    appended.append(new ArrayVector(['x', 'y', 'z']));
    expect(appended.toArray()).toEqual([1, 2, undefined, undefined, undefined, undefined, 'x', 'y', 'z']);
  });
});
