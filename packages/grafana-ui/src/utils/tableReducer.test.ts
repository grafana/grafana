import { parseCSV } from './processTableData';
import { reduceTableData, getTableReducers, TableReducerID } from './tableReducer';

describe('Table Reducer', () => {
  const basicTable = parseCSV('a,b,c\n10,20,30\n20,30,40');

  it('should load all standard stats', () => {
    const names = [
      TableReducerID.sum,
      TableReducerID.max,
      TableReducerID.min,
      TableReducerID.logmin,
      TableReducerID.mean,
      TableReducerID.last,
      TableReducerID.first,
      TableReducerID.count,
      TableReducerID.range,
      TableReducerID.diff,
      TableReducerID.step,
      TableReducerID.delta,
      // TableReducerID.allIsZero,
      // TableReducerID.allIsNull,
    ];
    const notFound: string[] = [];
    const reducers = getTableReducers(names, notFound);
    reducers.forEach((reducer, index) => {
      expect(reducer ? reducer.value : '<missing>').toEqual(names[index]);
    });
    expect(notFound.length).toBe(0);
  });

  it('should fail to load unknown reducers', () => {
    const names = ['not a reducer', TableReducerID.max, TableReducerID.min, 'also not a reducer'];
    const notFound: string[] = [];
    const reducers = getTableReducers(names, notFound);
    expect(reducers.length).toBe(2);
    expect(notFound.length).toBe(2);
  });

  it('should calculate stats', () => {
    const reduced = reduceTableData(basicTable, {
      columnIndexes: [0, 1],
      stats: ['first', 'last', 'mean'],
    });

    expect(reduced.length).toBe(3);

    // First
    expect(reduced[0].rows[0]).toEqual([10, 20]);

    // Last
    expect(reduced[1].rows[0]).toEqual([20, 30]);

    // Mean
    expect(reduced[2].rows[0]).toEqual([15, 25]);
  });

  it('should support a single stat also', () => {
    // First
    let reduced = reduceTableData(basicTable, {
      columnIndexes: [0, 1],
      stats: ['first'],
    });
    expect(reduced.length).toBe(1);
    expect(reduced[0].rows[0]).toEqual([10, 20]);

    // Last
    reduced = reduceTableData(basicTable, {
      columnIndexes: [0, 1],
      stats: ['last'],
    });
    expect(reduced.length).toBe(1);
    expect(reduced[0].rows[0]).toEqual([20, 30]);

    // Mean
    reduced = reduceTableData(basicTable, {
      columnIndexes: [0, 1],
      stats: ['mean'],
    });

    expect(reduced.length).toBe(1);
    expect(reduced[0].rows[0]).toEqual([15, 25]);
  });
});
