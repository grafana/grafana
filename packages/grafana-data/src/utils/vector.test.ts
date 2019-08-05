import { ConstantVector, ScaledVector, ArrayVector } from './vector';

describe('Check Proxy Vector', () => {
  it('should support constant values', () => {
    const value = 3.5;
    const v = new ConstantVector(value, 7);
    expect(v.getLength()).toEqual(7);

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
    expect(v.getLength()).toEqual(source.getLength());
    //  expect(v.push(10)).toEqual(source.length); // not implemented
    for (let i = 0; i < 10; i++) {
      expect(v.get(i)).toEqual(source.get(i) * scale);
    }
  });
});
