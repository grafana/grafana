import { toDataFrame } from '../dataframe/processDataFrame';
import { FieldType } from '../types';
import { mockTransformationsRegistry } from '../utils/tests/mockTransformationsRegistry';

import { ReducerID } from './fieldReducer';
import { FrameMatcherID } from './matchers/ids';
import { transformDataFrame } from './transformDataFrame';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { DataTransformerID } from './transformers/ids';
import { reduceTransformer, ReduceTransformerMode } from './transformers/reduce';

const seriesAWithSingleField = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
    { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
  ],
});

describe('transformDataFrame', () => {
  beforeAll(() => {
    mockTransformationsRegistry([reduceTransformer, filterFieldsByNameTransformer]);
  });

  it('Applies all transforms', async () => {
    const cfg = [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: [ReducerID.first],
        },
      },
      {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/First/',
          },
        },
      },
    ];

    await expect(transformDataFrame(cfg, [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];
      expect(processed[0].length).toEqual(1);
      expect(processed[0].fields.length).toEqual(1);
      expect(processed[0].fields[0].values.get(0)).toEqual(3);
    });
  });

  it('Skips over disabled transforms', async () => {
    const cfg = [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: [ReducerID.first],
        },
      },
      {
        id: DataTransformerID.filterFieldsByName,
        disabled: true,
        options: {
          include: {
            pattern: '/First/',
          },
        },
      },
    ];

    await expect(transformDataFrame(cfg, [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];
      expect(processed[0].length).toEqual(1);
      expect(processed[0].fields.length).toEqual(2);
      expect(processed[0].fields[0].values.get(0)).toEqual('temperature');
    });
  });

  it('Support filtering', async () => {
    const frameA = toDataFrame({
      refId: 'A',
      fields: [{ name: 'value', type: FieldType.number, values: [5, 6] }],
    });
    const frameB = toDataFrame({
      refId: 'B',
      fields: [{ name: 'value', type: FieldType.number, values: [7, 8] }],
    });

    const cfg = [
      {
        id: DataTransformerID.reduce,
        filter: {
          id: FrameMatcherID.byRefId,
          options: 'A', // Only apply to A
        },
        options: {
          reducers: [ReducerID.first],
          mode: ReduceTransformerMode.ReduceFields,
        },
      },
    ];

    // Only apply A
    await expect(transformDataFrame(cfg, [frameA, frameB])).toEmitValuesWith((received) => {
      const processed = received[0].map((v) => v.fields[0].values.toArray());
      expect(processed).toBeTruthy();
      expect(processed).toMatchObject([[5], [7, 8]]);
    });

    // Only apply to B
    cfg[0].filter.options = 'B';
    await expect(transformDataFrame(cfg, [frameA, frameB])).toEmitValuesWith((received) => {
      const processed = received[0].map((v) => v.fields[0].values.toArray());
      expect(processed).toBeTruthy();
      expect(processed).toMatchObject([[5, 6], [7]]);
    });
  });
});
