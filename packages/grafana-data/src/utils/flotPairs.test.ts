import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { dateTime } from '../datetime/moment_wrapper';
import { TimeRange } from '../types/time';

import { getFlotPairs, getFlotPairsConstant } from './flotPairs';

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

describe('getFlotPairsConstant', () => {
  const makeRange = (from: number, to: number): TimeRange => ({
    from: dateTime(from),
    to: dateTime(to),
    raw: { from: `${from}`, to: `${to}` },
  });

  it('should return an empty series on empty data', () => {
    const range: TimeRange = makeRange(0, 1);
    const pairs = getFlotPairsConstant([], range);
    expect(pairs).toMatchObject([]);
  });

  it('should return an empty series on missing range', () => {
    const pairs = getFlotPairsConstant([], {} as TimeRange);
    expect(pairs).toMatchObject([]);
  });

  it('should return an constant series for range', () => {
    const range: TimeRange = makeRange(0, 1);
    const pairs = getFlotPairsConstant(
      [
        [2, 123],
        [4, 456],
      ],
      range
    );
    expect(pairs).toMatchObject([
      [0, 123],
      [1, 123],
    ]);
  });
});
