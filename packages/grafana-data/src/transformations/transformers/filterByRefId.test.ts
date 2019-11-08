import { DataTransformerID } from './ids';
import { transformDataFrame } from '../transformers';
import { toDataFrame } from '../../dataframe/processDataFrame';

export const allSeries = [
  toDataFrame({
    refId: 'A',
    fields: [],
  }),
  toDataFrame({
    refId: 'B',
    fields: [],
  }),
  toDataFrame({
    refId: 'C',
    fields: [],
  }),
];

describe('filterByRefId transformer', () => {
  it('returns all series if no options provided', () => {
    const cfg = {
      id: DataTransformerID.filterByRefId,
      options: {},
    };

    const filtered = transformDataFrame([cfg], allSeries);
    expect(filtered.length).toBe(3);
  });

  describe('respects', () => {
    it('inclusion', () => {
      const cfg = {
        id: DataTransformerID.filterByRefId,
        options: {
          include: 'A|B',
        },
      };

      const filtered = transformDataFrame([cfg], allSeries);
      expect(filtered.map(f => f.refId)).toEqual(['A', 'B']);
    });
  });
});
