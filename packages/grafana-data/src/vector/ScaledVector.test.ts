import { ArrayVector } from './ArrayVector';
import { ScaledVector } from './ScaledVector';

describe('ScaledVector', () => {
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
