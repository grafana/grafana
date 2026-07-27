import { bucketQueryLength } from './bucketQueryLength';

describe('bucketQueryLength', () => {
  it.each([
    [0, 'empty'],
    [1, '1-3'],
    [3, '1-3'],
    [4, '4-10'],
    [10, '4-10'],
    [11, '11+'],
    [100, '11+'],
  ] as const)('length %i -> %s', (len, expected) => {
    expect(bucketQueryLength(len)).toBe(expected);
  });
});
