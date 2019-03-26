import { parseCSV } from './processSeriesData';
import { getStatsCalculators, StatID, calculateStats } from './statsCalculator';

import _ from 'lodash';

describe('Stats Calculators', () => {
  const basicTable = parseCSV('a,b,c\n10,20,30\n20,30,40');

  it('should load all standard stats', () => {
    const names = [
      StatID.sum,
      StatID.max,
      StatID.min,
      StatID.logmin,
      StatID.mean,
      StatID.last,
      StatID.first,
      StatID.count,
      StatID.range,
      StatID.diff,
      StatID.step,
      StatID.delta,
      // StatID.allIsZero,
      // StatID.allIsNull,
    ];
    const stats = getStatsCalculators(names);
    expect(stats.length).toBe(names.length);
  });

  it('should fail to load unknown stats', () => {
    const names = ['not a stat', StatID.max, StatID.min, 'also not a stat'];
    const stats = getStatsCalculators(names);
    expect(stats.length).toBe(2);

    const found = stats.map(v => v.id);
    const notFound = _.difference(names, found);
    expect(notFound.length).toBe(2);

    expect(notFound[0]).toBe('not a stat');
  });

  it('should calculate basic stats', () => {
    const stats = calculateStats({
      series: basicTable,
      fieldIndex: 0,
      stats: ['first', 'last', 'mean'],
    });

    // First
    expect(stats.first).toEqual(10);

    // Last
    expect(stats.last).toEqual(20);

    // Mean
    expect(stats.mean).toEqual(15);
  });

  it('should support a single stat also', () => {
    const stats = calculateStats({
      series: basicTable,
      fieldIndex: 0,
      stats: ['first'],
    });

    // Should do the simple version that just looks up value
    expect(Object.keys(stats).length).toEqual(1);
    expect(stats.first).toEqual(10);
  });

  it('should get non standard stats', () => {
    const stats = calculateStats({
      series: basicTable,
      fieldIndex: 0,
      stats: [StatID.distinctCount, StatID.changeCount],
    });

    expect(stats.distinctCount).toEqual(2);
    expect(stats.changeCount).toEqual(1);
  });

  it('should calculate step', () => {
    const stats = calculateStats({
      series: { fields: [{ name: 'A' }], rows: [[100], [200], [300], [400]] },
      fieldIndex: 0,
      stats: [StatID.step, StatID.delta],
    });

    expect(stats.step).toEqual(100);
    expect(stats.delta).toEqual(300);
  });
});
