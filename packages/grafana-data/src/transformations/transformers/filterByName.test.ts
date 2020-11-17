import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { filterFieldsByNameTransformer } from './filterByName';
import { filterFieldsTransformer } from './filter';
import { transformDataFrame } from '../transformDataFrame';
import { observableTester } from '../../utils/tests/observableTester';

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

  it('returns original series if no options provided', done => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {},
    };

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields.length).toBe(4);
      },
      done,
    });
  });

  describe('respects', () => {
    it('inclusion by pattern', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('startsWithA');
        },
        done,
      });
    });

    it('exclusion by pattern', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });

    it('inclusion and exclusion by pattern', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { pattern: '/^(startsWith)/' },
          include: { pattern: '/^(B)$/' },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(1);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });

    it('inclusion by names', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('startsWithA');
        },
        done,
      });
    });

    it('exclusion by names', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });

    it('inclusion and exclusion by names', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { names: ['B'] },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(1);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });

    it('inclusion by both', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('startsWithA');
        },
        done,
      });
    });

    it('exclusion by both', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(2);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });

    it('inclusion and exclusion by both', done => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { pattern: '/^(B)$/' },
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithNamesToMatch]),
        expect: data => {
          const filtered = data[0];
          expect(filtered.fields.length).toBe(1);
          expect(filtered.fields[0].name).toBe('B');
        },
        done,
      });
    });
  });
});
