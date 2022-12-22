import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { filterFramesByRefIdTransformer } from './filterByRefId';
import { DataTransformerID } from './ids';

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

  it('returns all series if no options provided', async () => {
    const cfg = {
      id: DataTransformerID.filterByRefId,
      options: {},
    };

    await expect(transformDataFrame([cfg], allSeries)).toEmitValuesWith((received) => {
      const filtered = received[0];
      expect(filtered.length).toBe(3);
    });
  });

  describe('respects', () => {
    it('inclusion', async () => {
      const cfg = {
        id: DataTransformerID.filterByRefId,
        options: {
          include: 'A|B',
        },
      };

      await expect(transformDataFrame([cfg], allSeries)).toEmitValuesWith((received) => {
        const filtered = received[0];
        expect(filtered.map((f) => f.refId)).toEqual(['A', 'B']);
      });
    });
  });
});
