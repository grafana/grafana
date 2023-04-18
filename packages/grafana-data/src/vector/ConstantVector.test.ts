import { ConstantVector } from './ConstantVector';

describe('ConstantVector', () => {
  it('should support constant values', () => {
    const value = 3.5;
    const v = new ConstantVector(value, 7);
    expect(v.length).toEqual(7);

    expect(v.get(0)).toEqual(value);
    expect(v.get(1)).toEqual(value);

    // Now check all of them
    for (let i = 0; i < 10; i++) {
      expect(v.get(i)).toEqual(value);
      expect(v[i]).toEqual(value);
    }
  });
});
