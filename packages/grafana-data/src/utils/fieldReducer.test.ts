import { getFieldReducers, ReducerID, reduceField } from './index';

import _ from 'lodash';

describe('Stats Calculators', () => {
  const basicTable = {
    fields: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    rows: [[10, 20, 30], [20, 30, 40]],
  };

  it('should load all standard stats', () => {
    const names = [
      ReducerID.sum,
      ReducerID.max,
      ReducerID.min,
      ReducerID.logmin,
      ReducerID.mean,
      ReducerID.last,
      ReducerID.first,
      ReducerID.count,
      ReducerID.range,
      ReducerID.diff,
      ReducerID.step,
      ReducerID.delta,
      // ReducerID.allIsZero,
      // ReducerID.allIsNull,
    ];
    const stats = getFieldReducers(names);
    expect(stats.length).toBe(names.length);
  });

  it('should fail to load unknown stats', () => {
    const names = ['not a stat', ReducerID.max, ReducerID.min, 'also not a stat'];
    const stats = getFieldReducers(names);
    expect(stats.length).toBe(2);

    const found = stats.map(v => v.id);
    const notFound = _.difference(names, found);
    expect(notFound.length).toBe(2);

    expect(notFound[0]).toBe('not a stat');
  });

  it('should calculate basic stats', () => {
    const stats = reduceField({
      series: basicTable,
      fieldIndex: 0,
      reducers: ['first', 'last', 'mean'],
    });

    // First
    expect(stats.first).toEqual(10);

    // Last
    expect(stats.last).toEqual(20);

    // Mean
    expect(stats.mean).toEqual(15);
  });

  it('should support a single stat also', () => {
    const stats = reduceField({
      series: basicTable,
      fieldIndex: 0,
      reducers: ['first'],
    });

    // Should do the simple version that just looks up value
    expect(Object.keys(stats).length).toEqual(1);
    expect(stats.first).toEqual(10);
  });

  it('should get non standard stats', () => {
    const stats = reduceField({
      series: basicTable,
      fieldIndex: 0,
      reducers: [ReducerID.distinctCount, ReducerID.changeCount],
    });

    expect(stats.distinctCount).toEqual(2);
    expect(stats.changeCount).toEqual(1);
  });

  it('should calculate step', () => {
    const stats = reduceField({
      series: { fields: [{ name: 'A' }], rows: [[100], [200], [300], [400]] },
      fieldIndex: 0,
      reducers: [ReducerID.step, ReducerID.delta],
    });

    expect(stats.step).toEqual(100);
    expect(stats.delta).toEqual(300);
  });

  it('consistent results for first/last value with null', () => {
    const info = [
      {
        rows: [[null], [200], [null]], // first/last value is null
        result: 200,
      },
      {
        rows: [[null], [null], [null]], // All null
        result: undefined,
      },
      {
        rows: [], // Empty row
        result: undefined,
      },
    ];
    const fields = [{ name: 'A' }];

    const stats = reduceField({
      series: { rows: info[0].rows, fields },
      fieldIndex: 0,
      reducers: [ReducerID.first, ReducerID.last, ReducerID.firstNotNull, ReducerID.lastNotNull], // uses standard path
    });
    expect(stats[ReducerID.first]).toEqual(null);
    expect(stats[ReducerID.last]).toEqual(null);
    expect(stats[ReducerID.firstNotNull]).toEqual(200);
    expect(stats[ReducerID.lastNotNull]).toEqual(200);

    const reducers = [ReducerID.lastNotNull, ReducerID.firstNotNull];
    for (const input of info) {
      for (const reducer of reducers) {
        const v1 = reduceField({
          series: { rows: input.rows, fields },
          fieldIndex: 0,
          reducers: [reducer, ReducerID.mean], // uses standard path
        })[reducer];

        const v2 = reduceField({
          series: { rows: input.rows, fields },
          fieldIndex: 0,
          reducers: [reducer], // uses optimized path
        })[reducer];

        if (v1 !== v2 || v1 !== input.result) {
          const msg =
            `Invalid ${reducer} result for: ` +
            input.rows.join(', ') +
            ` Expected: ${input.result}` + // configured
            ` Recieved: Multiple: ${v1}, Single: ${v2}`;
          expect(msg).toEqual(null);
        }
      }
    }
  });
});
