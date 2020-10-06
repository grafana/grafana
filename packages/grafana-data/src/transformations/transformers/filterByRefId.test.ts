import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { filterFramesByRefIdTransformer } from './filterByRefId';
import { transformDataFrame } from '../transformDataFrame';
import { observableTester } from '../../utils/tests/observableTester';

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

  it('returns all series if no options provided', done => {
    const cfg = {
      id: DataTransformerID.filterByRefId,
      options: {},
    };

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], allSeries),
      expect: filtered => {
        expect(filtered.length).toBe(3);
      },
      done,
    });
  });

  describe('respects', () => {
    it('inclusion', done => {
      const cfg = {
        id: DataTransformerID.filterByRefId,
        options: {
          include: 'A|B',
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], allSeries),
        expect: filtered => {
          expect(filtered.map(f => f.refId)).toEqual(['A', 'B']);
        },
        done,
      });
    });
  });
});
