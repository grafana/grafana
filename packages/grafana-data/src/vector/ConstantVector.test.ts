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
    }
  });

  it('should be iterable', () => {
    const value = 3.5;
    const vec = new ConstantVector(value, 7);

    let i = 0;
    for (const val of vec) {
      if (i > 10) {
        break;
      }

      expect(val).toEqual(value);
      i += 1;
    }
  });
});
