import { toDataFrame } from '../../dataframe/processDataFrame';
import { getFrameDisplayName } from '../../field/fieldState';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { filterFieldsTransformer } from './filter';
import { filterFieldsByNameTransformer } from './filterByName';
import { DataTransformerID } from './ids';

export const seriesWithNamesToMatch = toDataFrame({
  fields: [
    { name: 'startsWithA', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.boolean, values: [true, false] },
    { name: 'startsWithC', type: FieldType.string, values: ['a', 'b'] },
    { name: 'D', type: FieldType.number, values: [1, 2] },
  ],
});

describe('filterByName transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterFieldsByNameTransformer, filterFieldsTransformer]);
  });

  it('returns original series if no options provided', async () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {},
    };

    await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(4);
    });
  });

  it.each([
    { name: 'including selected fields', options: { include: { names: ['Time', 'Value B'] } } },
    { name: 'excluding a value field', options: { exclude: { names: ['Value A'] } } },
  ])('preserves frame display names when $name leaves only a time field', async ({ options }) => {
    const frames = ['A', 'B'].map((refId) =>
      toDataFrame({
        refId,
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { name: `Value ${refId}`, type: FieldType.number, values: [1, 2] },
        ],
      })
    );
    const cfg = { id: DataTransformerID.filterFieldsByName, options };

    await expect(transformDataFrame([cfg], frames)).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data.map((frame) => frame.fields.map((field) => field.name))).toEqual([['Time'], ['Time', 'Value B']]);
      expect(data.map((frame) => getFrameDisplayName(frame))).toEqual(['Series (A)', 'Value B']);
    });
  });

  describe('respects', () => {
    it('inclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { pattern: '/^(startsWith)/' },
          include: { pattern: '/^(B)$/' },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { names: ['B'] },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { pattern: '/^(B)$/' },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });
  });
});
