import { toDataFrame } from '../../dataframe/processDataFrame';
import { type Field, FieldType } from '../../types/dataFrame';
import { type DataTransformerConfig } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { sortByTransformer, type SortByTransformerOptions } from './sortBy';

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

  describe('multiple fields', () => {
    const teamsFrame = toDataFrame({
      name: 'teams',
      fields: [
        { name: 'team', type: FieldType.string, values: ['b', 'a', 'b', 'a', 'a'] },
        { name: 'score', type: FieldType.number, values: [10, 10, 20, 20, 15] },
        { name: 'name', type: FieldType.string, values: ['zoe', 'bob', 'cal', 'amy', 'ann'] },
      ],
    });

    const sortNames = async (sort: SortByTransformerOptions['sort']) => {
      const cfg: DataTransformerConfig<SortByTransformerOptions> = { id: DataTransformerID.sortBy, options: { sort } };
      let names: unknown[] = [];
      await expect(transformDataFrame([cfg], [teamsFrame])).toEmitValuesWith((received) => {
        names = received[0][0].fields[2].values;
      });
      return names;
    };

    it('uses later fields to break ties of earlier ones', async () => {
      expect(await sortNames([{ field: 'team' }, { field: 'score', desc: true }])).toEqual([
        'amy',
        'ann',
        'bob',
        'cal',
        'zoe',
      ]);
    });

    it('applies the direction of each field independently', async () => {
      expect(await sortNames([{ field: 'team', desc: true }, { field: 'score' }])).toEqual([
        'zoe',
        'cal',
        'bob',
        'ann',
        'amy',
      ]);
    });

    it('skips fields that are missing from the frame', async () => {
      expect(await sortNames([{ field: 'team' }, { field: 'not-a-field' }, { field: 'score', desc: true }])).toEqual([
        'amy',
        'ann',
        'bob',
        'cal',
        'zoe',
      ]);
    });

    it('ignores entries without a field', async () => {
      expect(await sortNames([{ field: '' }, { field: 'score', desc: true }])).toEqual([
        'cal',
        'amy',
        'ann',
        'zoe',
        'bob',
      ]);
    });

    it('returns the frame unchanged when no field matches', async () => {
      const cfg: DataTransformerConfig<SortByTransformerOptions> = {
        id: DataTransformerID.sortBy,
        options: { sort: [{ field: '' }, { field: 'not-a-field' }] },
      };
      await expect(transformDataFrame([cfg], [teamsFrame])).toEmitValuesWith((received) => {
        expect(received[0][0]).toBe(teamsFrame);
      });
    });
  });
});

function getFieldSnapshot(f: Field): Object {
  return { name: f.name, values: f.values };
}
