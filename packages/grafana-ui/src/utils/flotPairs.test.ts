import { getFlotPairs } from './flotPairs';

describe('getFlotPairs', () => {
  const table = {
    rows: [[1, 100, 'a'], [2, 200, 'b'], [3, 300, 'c']],
  };
  it('should get X and y', () => {
    const pairs = getFlotPairs({ rows: table.rows, xIndex: 0, yIndex: 1 });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual(100);
  });

  it('should work with strings', () => {
    const pairs = getFlotPairs({ rows: table.rows, xIndex: 0, yIndex: 2 });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual('a');
  });
});
