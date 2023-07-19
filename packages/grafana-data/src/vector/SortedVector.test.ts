import { ArrayVector } from './ArrayVector';
import { SortedVector } from './SortedVector';

describe('SortedVector', () => {
  it('Should support sorting', () => {
    const values = new ArrayVector([1, 5, 2, 4]);
    const sorted = new SortedVector(values, [0, 2, 3, 1]);
    expect(sorted.toArray()).toEqual([1, 2, 4, 5]);

    // The proxy should still be an instance of SortedVector (used in timeseries)
    expect(sorted instanceof SortedVector).toBeTruthy();
  });
});
