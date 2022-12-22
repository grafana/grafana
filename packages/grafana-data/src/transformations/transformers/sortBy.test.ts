import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { sortByTransformer, SortByTransformerOptions } from './sortBy';

const testFrame = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [10, 9, 8, 7, 6, 5] }, // desc
    { name: 'text', type: FieldType.string, values: ['a', 'z', 'b', 'x', 'c'] },
    { name: 'count', type: FieldType.string, values: [1, 2, 3, 4, 5] }, // asc
  ],
});

describe('SortBy transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([sortByTransformer]);
  });

  it('should not apply transformation if config is missing sort fields', async () => {
    const cfg: DataTransformerConfig<SortByTransformerOptions> = {
      id: DataTransformerID.sortBy,
      options: {
        sort: [], // nothing
      },
    };

    await expect(transformDataFrame([cfg], [testFrame])).toEmitValuesWith((received) => {
      const result = received[0];
      expect(result[0]).toBe(testFrame);
    });
  });

  it('should sort time asc', async () => {
    const cfg: DataTransformerConfig<SortByTransformerOptions> = {
      id: DataTransformerID.sortBy,
      options: {
        sort: [
          {
            field: 'time',
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testFrame])).toEmitValuesWith((received) => {
      expect(getFieldSnapshot(received[0][0].fields[0])).toMatchInlineSnapshot(`
        {
          "name": "time",
          "values": [
            5,
            6,
            7,
            8,
            9,
            10,
          ],
        }
      `);
    });
  });

  it('should sort time (desc)', async () => {
    const cfg: DataTransformerConfig<SortByTransformerOptions> = {
      id: DataTransformerID.sortBy,
      options: {
        sort: [
          {
            field: 'time',
            desc: true,
          },
        ],
      },
    };

    await expect(transformDataFrame([cfg], [testFrame])).toEmitValuesWith((received) => {
      expect(getFieldSnapshot(received[0][0].fields[0])).toMatchInlineSnapshot(`
        {
          "name": "time",
          "values": [
            10,
            9,
            8,
            7,
            6,
            5,
          ],
        }
      `);
    });
  });
});

function getFieldSnapshot(f: Field): Object {
  return { name: f.name, values: f.values.toArray() };
}
