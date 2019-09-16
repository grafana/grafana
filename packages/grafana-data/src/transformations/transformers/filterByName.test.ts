import { DataTransformerID } from './ids';
import { transformDataFrame } from '../transformers';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';

export const seriesWithNamesToMatch = toDataFrame({
  fields: [
    { name: 'startsWithA', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.boolean, values: [true, false] },
    { name: 'startsWithC', type: FieldType.string, values: ['a', 'b'] },
    { name: 'D', type: FieldType.number, values: [1, 2] },
  ],
});

describe('filterByName transformer', () => {
  it('returns original series if no options provided', () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {},
    };

    const filtered = transformDataFrame([cfg], [seriesWithNamesToMatch])[0];
    expect(filtered.fields.length).toBe(4);
  });

  describe('respects', () => {
    it('inclusion', () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: '/^(startsWith)/',
        },
      };

      const filtered = transformDataFrame([cfg], [seriesWithNamesToMatch])[0];
      expect(filtered.fields.length).toBe(2);
      expect(filtered.fields[0].name).toBe('startsWithA');
    });

    it('exclusion', () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: '/^(startsWith)/',
        },
      };

      const filtered = transformDataFrame([cfg], [seriesWithNamesToMatch])[0];
      expect(filtered.fields.length).toBe(2);
      expect(filtered.fields[0].name).toBe('B');
    });

    it('inclusion and exclusion', () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: '/^(startsWith)/',
          include: `/^(B)$/`,
        },
      };

      const filtered = transformDataFrame([cfg], [seriesWithNamesToMatch])[0];
      expect(filtered.fields.length).toBe(1);
      expect(filtered.fields[0].name).toBe('B');
    });
  });
});
