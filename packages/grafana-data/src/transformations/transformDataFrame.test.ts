import { ReducerID } from './fieldReducer';
import { DataTransformerID } from './transformers/ids';
import { toDataFrame } from '../dataframe/processDataFrame';
import { mockTransformationsRegistry } from '../utils/tests/mockTransformationsRegistry';
import { reduceTransformer } from './transformers/reduce';
import { filterFieldsByNameTransformer } from './transformers/filterByName';
import { transformDataFrame } from './transformDataFrame';
import { FieldType } from '../types';

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
});
