import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { filterFramesByRefIdTransformer } from './filterByRefId';
import { transformDataFrame } from '../transformDataFrame';

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
  beforeAll(() => {
    mockTransformationsRegistry([filterFramesByRefIdTransformer]);
  });
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
