import { ConstantVector, ScaledVector, ArrayVector, CircularVector } from './vector';

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
  it('should append values', () => {
    const buffer = [1, 2, 3];
    const v = new CircularVector(buffer);
    expect(v.toJSON()).toEqual([1, 2, 3]);

    v.append(4);
    expect(v.toJSON()).toEqual([2, 3, 4]);

    v.append(5);
    expect(v.toJSON()).toEqual([3, 4, 5]);

    v.append(6);
    expect(v.toJSON()).toEqual([4, 5, 6]);

    v.append(7);
    expect(v.toJSON()).toEqual([5, 6, 7]);

    v.append(8);
    expect(v.toJSON()).toEqual([6, 7, 8]);
  });
});
