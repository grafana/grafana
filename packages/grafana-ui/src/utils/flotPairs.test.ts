import { getFlotPairs } from './flotPairs';
import { MutableDataFrame } from '@grafana/data';

describe('getFlotPairs', () => {
  const series = new MutableDataFrame({
    fields: [
      { name: 'a', values: [1, 2, 3] },
      { name: 'b', values: [100, 200, 300] },
      { name: 'c', values: ['a', 'b', 'c'] },
    ],
  });
  it('should get X and y', () => {
    const pairs = getFlotPairs({
      xField: series.fields[0],
      yField: series.fields[1],
    });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual(100);
  });

  it('should work with strings', () => {
    const pairs = getFlotPairs({
      xField: series.fields[0],
      yField: series.fields[2],
    });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual('a');
  });
});
