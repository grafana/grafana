import { readCSV } from './csv';

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    return readCSV(text).then(tables => {
      expect(tables.length).toBe(1);

      const table = tables[0];
      expect(table.columns.length).toBe(4);
      expect(table.rows.length).toBe(3);

      // Make sure everythign it padded properly

      expect(tables[0]).toMatchSnapshot();
    });
  });
});
