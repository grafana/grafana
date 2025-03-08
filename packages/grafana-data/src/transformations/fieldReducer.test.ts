import { difference } from 'lodash';

import { createDataFrame, guessFieldTypeFromValue } from '../dataframe/processDataFrame';
import { NullValueMode } from '../types/data';
import { Field, FieldType } from '../types/dataFrame';

import { fieldReducers, ReducerID, reduceField, defaultCalcs } from './fieldReducer';

/**
 * Run a reducer and get back the value
 */
function reduce(field: Field, id: string) {
  return reduceField({ field, reducers: [id] })[id];
}

function createField<T>(name: string, values?: T[], type?: FieldType): Field<T> {
  const arr = values ?? [];
  return {
    name,
    config: {},
    type: type ? type : guessFieldTypeFromValue(arr[0]),
    values: arr,
  };
}

describe('Stats Calculators', () => {
  const basicTable = createDataFrame({
    fields: [
      { name: 'a', values: [10, 20] },
      { name: 'b', values: [20, 30] },
      { name: 'c', values: [30, 40] },
    ],
  });

  it('should load all standard stats', () => {
    for (const id of Object.keys(ReducerID)) {
      const reducer = fieldReducers.getIfExists(id);
      const found = reducer ? reducer.id : '<NOT FOUND>';
      expect(found).toEqual(id);
    }
  });

  it('should fail to load unknown stats', () => {
    const names = ['not a stat', ReducerID.max, ReducerID.min, 'also not a stat'];
    const stats = fieldReducers.list(names);
    expect(stats.length).toBe(2);

    const found = stats.map((v) => v.id);
    const notFound = difference(names, found);
    expect(notFound.length).toBe(2);

    expect(notFound[0]).toBe('not a stat');
  });

  it('should calculate basic stats', () => {
    const stats = reduceField({
      field: basicTable.fields[0],
      reducers: [ReducerID.first, ReducerID.last, ReducerID.mean, ReducerID.count, ReducerID.diffperc],
    });

    expect(stats.first).toEqual(10);
    expect(stats.last).toEqual(20);
    expect(stats.mean).toEqual(15);
    expect(stats.count).toEqual(2);
    expect(stats.diffperc).toEqual(100);
  });

  it('should handle undefined field data without crashing', () => {
    const stats = reduceField({
      field: { name: 'a', values: undefined as unknown as unknown[], config: {}, type: FieldType.number },
      reducers: [ReducerID.first, ReducerID.last, ReducerID.mean, ReducerID.count],
    });

    expect(stats).toEqual(defaultCalcs);
  });

  it('should support a single stat also', () => {
    basicTable.fields[0].state = undefined; // clear the cache
    const stats = reduceField({
      field: basicTable.fields[0],
      reducers: [ReducerID.first],
    });

    // Should do the simple version that just looks up value
    expect(Object.keys(stats).length).toEqual(1);
    expect(stats.first).toEqual(10);
  });

  it('should get non standard stats', () => {
    const stats = reduceField({
      field: basicTable.fields[0],
      reducers: [ReducerID.distinctCount, ReducerID.changeCount, ReducerID.variance, ReducerID.stdDev],
    });

    expect(stats.distinctCount).toEqual(2);
    expect(stats.changeCount).toEqual(1);
    expect(stats.variance).toEqual(25);
    expect(stats.stdDev).toEqual(5);
  });

  it('should calculate step', () => {
    const stats = reduceField({
      field: createField('x', [100, 200, 300, 400]),
      reducers: [ReducerID.step, ReducerID.delta],
    });

    expect(stats.step).toEqual(100);
    expect(stats.delta).toEqual(300);
  });

  it('should calculate unique values', () => {
    const stats = reduceField({
      field: createField('x', [1, 2, 2, 3, 1]),
      reducers: [ReducerID.uniqueValues],
    });

    expect(stats.uniqueValues).toEqual([1, 2, 3]);
  });

  it('consistently check allIsNull/allIsZero', () => {
    const empty = createField('x');
    const allNull = createField('x', [null, null, null, null]);
    const allUndefined = createField('x', [undefined, undefined, undefined, undefined]);
    const allZero = createField('x', [0, 0, 0, 0]);

    expect(reduce(empty, ReducerID.allIsNull)).toEqual(true);
    expect(reduce(allNull, ReducerID.allIsNull)).toEqual(true);
    expect(reduce(allUndefined, ReducerID.allIsNull)).toEqual(true);

    expect(reduce(empty, ReducerID.allIsZero)).toEqual(false);
    expect(reduce(allNull, ReducerID.allIsZero)).toEqual(false);
    expect(reduce(allZero, ReducerID.allIsZero)).toEqual(true);
  });

  it('consistent results for first/last value with null', () => {
    const info = [
      {
        data: [null, 200, null], // first/last value is null
        result: 200,
      },
      {
        data: [null, null, null], // All null
        result: null,
      },
      {
        data: [undefined, undefined, undefined], // Empty row
        result: null,
      },
    ];

    const stats = reduceField({
      field: createField('x', info[0].data),
      reducers: [ReducerID.first, ReducerID.last, ReducerID.firstNotNull, ReducerID.lastNotNull, ReducerID.diffperc], // uses standard path
    });
    expect(stats[ReducerID.first]).toEqual(null);
    expect(stats[ReducerID.last]).toEqual(null);
    expect(stats[ReducerID.firstNotNull]).toEqual(200);
    expect(stats[ReducerID.lastNotNull]).toEqual(200);
    expect(stats[ReducerID.diffperc]).toEqual(0);

    const reducers = [ReducerID.lastNotNull, ReducerID.firstNotNull];
    for (const input of info) {
      for (const reducer of reducers) {
        const v1 = reduceField({
          field: createField('x', input.data),
          reducers: [reducer, ReducerID.mean], // uses standard path
        })[reducer];

        const v2 = reduceField({
          field: createField('x', input.data),
          reducers: [reducer], // uses optimized path
        })[reducer];

        if (v1 !== v2 || v1 !== input.result) {
          const msg =
            `Invalid ${reducer} result for: ` +
            input.data.join(', ') +
            ` Expected: ${input.result}` + // configured
            ` Received: Multiple: ${v1}, Single: ${v2}`;
          expect(msg).toEqual(null);
        }
      }
    }
  });

  it('consistent results for first/last value with NaN', () => {
    const info = [
      {
        data: [NaN, 200, NaN], // first/last value is NaN
        result: 200,
      },
      {
        data: [NaN, NaN, NaN], // All NaN
        result: null,
      },
      {
        data: [undefined, undefined, undefined], // Empty row
        result: null,
      },
    ];

    const stats = reduceField({
      field: createField('x', info[0].data),
      reducers: [ReducerID.first, ReducerID.last, ReducerID.firstNotNull, ReducerID.lastNotNull, ReducerID.diffperc],
    });

    expect(stats[ReducerID.first]).toEqual(NaN);
    expect(stats[ReducerID.last]).toEqual(NaN);
    expect(stats[ReducerID.firstNotNull]).toEqual(200);
    expect(stats[ReducerID.lastNotNull]).toEqual(200);
    expect(stats[ReducerID.diffperc]).toEqual(0);

    const reducers = [ReducerID.lastNotNull, ReducerID.firstNotNull];
    for (const input of info) {
      for (const reducer of reducers) {
        const v1 = reduceField({
          field: createField('x', input.data),
          reducers: [reducer, ReducerID.mean], // uses standard path
        })[reducer];

        const v2 = reduceField({
          field: createField('x', input.data),
          reducers: [reducer], // uses optimized path
        })[reducer];

        if (v1 !== v2 || v1 !== input.result) {
          const msg =
            `Invalid ${reducer} result for: ` +
            input.data.join(', ') +
            ` Expected: ${input.result}` + // configured
            ` Received: Multiple: ${v1}, Single: ${v2}`;
          expect(msg).toEqual(null);
        }
      }
    }
  });

  const reducerTestCases = (values: (number | null)[]) => [
    // Min reducer
    { values, config: undefined, expected: 1, reducerID: ReducerID.min },
    { values, config: NullValueMode.Ignore, expected: 1, reducerID: ReducerID.min },
    { values, config: NullValueMode.Null, expected: 1, reducerID: ReducerID.min },
    { values, config: NullValueMode.AsZero, expected: 0, reducerID: ReducerID.min },
    // Mean reducer
    { values, config: undefined, expected: 2.5, reducerID: ReducerID.mean },
    { values, config: NullValueMode.Ignore, expected: 2.5, reducerID: ReducerID.mean },
    { values, config: NullValueMode.Null, expected: 2.5, reducerID: ReducerID.mean },
    { values, config: NullValueMode.AsZero, expected: 2, reducerID: ReducerID.mean },
    // Median reducer
    { values, config: undefined, expected: 2.5, reducerID: ReducerID.median },
    { values, config: NullValueMode.Ignore, expected: 2.5, reducerID: ReducerID.median },
    { values, config: NullValueMode.Null, expected: 2, reducerID: ReducerID.median },
    { values, config: NullValueMode.AsZero, expected: 2, reducerID: ReducerID.median },
    // Count reducer
    { values, config: undefined, expected: 4, reducerID: ReducerID.count },
    { values, config: NullValueMode.Ignore, expected: 4, reducerID: ReducerID.count },
    { values, config: NullValueMode.Null, expected: 5, reducerID: ReducerID.count },
    { values, config: NullValueMode.AsZero, expected: 5, reducerID: ReducerID.count },
    // Range reducer
    { values, config: undefined, expected: 3, reducerID: ReducerID.range },
    { values, config: NullValueMode.Ignore, expected: 3, reducerID: ReducerID.range },
    { values, config: NullValueMode.Null, expected: 3, reducerID: ReducerID.range },
    { values, config: NullValueMode.AsZero, expected: 4, reducerID: ReducerID.range },
    // Delta reducer
    { values, config: undefined, expected: 4, reducerID: ReducerID.delta },
    { values, config: NullValueMode.Ignore, expected: 4, reducerID: ReducerID.delta },
    { values, config: NullValueMode.Null, expected: 4, reducerID: ReducerID.delta },
    { values, config: NullValueMode.AsZero, expected: 6, reducerID: ReducerID.delta },
    // Distinct count reducer
    { values, config: undefined, expected: 4, reducerID: ReducerID.distinctCount },
    { values, config: NullValueMode.Ignore, expected: 4, reducerID: ReducerID.distinctCount },
    { values, config: NullValueMode.Null, expected: 5, reducerID: ReducerID.distinctCount },
    { values, config: NullValueMode.AsZero, expected: 5, reducerID: ReducerID.distinctCount },
    // Step reducer
    { values, config: undefined, expected: -1, reducerID: ReducerID.step },
    { values, config: NullValueMode.Ignore, expected: -1, reducerID: ReducerID.step },
    { values, config: NullValueMode.Null, expected: -1, reducerID: ReducerID.step },
    { values, config: NullValueMode.AsZero, expected: -3, reducerID: ReducerID.step },
    // Change count reducer
    { values, config: undefined, expected: 3, reducerID: ReducerID.changeCount },
    { values, config: NullValueMode.Ignore, expected: 3, reducerID: ReducerID.changeCount },
    { values, config: NullValueMode.Null, expected: 4, reducerID: ReducerID.changeCount },
    { values, config: NullValueMode.AsZero, expected: 4, reducerID: ReducerID.changeCount },
  ];

  // Programmatic testing of reducer functions to be sure they handle count nulls, ignore nulls, and null as zero
  it.each(reducerTestCases([3, null, 2, 1, 4]))(
    '$reducerID reducer returns count $expected for fieldConfig $config',
    ({ config, expected, reducerID, values }) => {
      const someNulls = createField('x', values);
      someNulls.config.nullValueMode = config;

      expect(reduce(someNulls, reducerID)).toEqual(expected);
    }
  );

  it('can reduce to percentiles', () => {
    // This `Array.from` will build an array of elements from 1 to 99
    const percentiles = [...Array.from({ length: 99 }, (_, i) => i + 1)];
    percentiles.forEach((percentile) => {
      const preciseStats = reduceField({
        field: createField(
          'x',
          Array.from({ length: 101 }, (_, index) => index)
        ),
        reducers: [(ReducerID as Record<string, ReducerID>)[`p${percentile}`]],
      });

      expect(preciseStats[`p${percentile}`]).toEqual(percentile);
    });
  });
});
