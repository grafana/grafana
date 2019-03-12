import { parseCSV } from './processTableData';
import { reduceTableData } from './tableReducer';

describe('Table Reducer', () => {
  const basicTable = parseCSV('a,b,c\n10,20,30\n20,30,40');

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
