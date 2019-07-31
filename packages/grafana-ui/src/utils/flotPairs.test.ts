import { getFlotPairs } from './flotPairs';
import { createField, FieldType } from '@grafana/data';

describe('getFlotPairs', () => {
  const series = {
    fields: [
      createField('a', FieldType.number, [1, 2, 3]),
      createField('b', FieldType.number, [100, 200, 300]),
      createField('c', FieldType.string, ['a', 'b', 'c']),
    ],
  };
  it('should get X and y', () => {
    const pairs = getFlotPairs({ series, xIndex: 0, yIndex: 1 });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual(100);
  });

  it('should work with strings', () => {
    const pairs = getFlotPairs({ series, xIndex: 0, yIndex: 2 });

    expect(pairs.length).toEqual(3);
    expect(pairs[0].length).toEqual(2);
    expect(pairs[0][0]).toEqual(1);
    expect(pairs[0][1]).toEqual('a');
  });
});
