import { createConstantVector, createScaledVector } from './vector';

describe('Check Proxy Vector', () => {
  it('should support constant values', () => {
    const value = 3.5;
    const v = createConstantVector({ value, length: 7 });
    expect(v.length).toEqual(7);

    expect(v[0]).toEqual(value);
    expect(v[1]).toEqual(value);

    // Now check all of them
    for (let i = 0; i < 10; i++) {
      expect(v[i]).toEqual(value);
    }
  });

  it('should support multiply operations', () => {
    const source = [1, 2, 3, 4];
    const scale = 2.456;
    const v = createScaledVector({ source, scale });
    expect(v.length).toEqual(source.length);
    //  expect(v.push(10)).toEqual(source.length); // not implemented
    for (let i = 0; i < 10; i++) {
      expect(v[i]).toEqual(source[i] * scale);
    }
  });
});
