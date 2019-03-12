import { parseCSV } from './processTableData';
import { reduceTableData } from './tableReducer';

describe('Table Reducer', () => {
  it('should calculate average', () => {
    const table = parseCSV('a,b,c\n1,2,3\n4,5,6');

    const reduced = reduceTableData(table, {
      stats: ['last'],
    });

    expect(reduced.length).toBe(1);
    expect(reduced[0].rows.length).toBe(1);
    expect(reduced[0].rows[0]).toEqual(table.rows[1]);

    console.log('REDUCE', reduced[0].rows);
  });
});
