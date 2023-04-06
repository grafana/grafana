import { ArrayVector } from './ArrayVector';

describe('ArrayVector', () => {
  it('should init 150k with 65k Array.push() chonking', () => {
    let arr = Array.from({ length: 150e3 }, (v, i) => i);
    let av = new ArrayVector(arr);

    expect(av).toEqual(arr);
  });
});
