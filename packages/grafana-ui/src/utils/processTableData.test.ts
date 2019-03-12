import { parseCSV } from './processTableData';

describe('processTableData', () => {
  describe('basic processing', () => {
    it('should read header and two rows', () => {
      const text = 'a,b,c\n1,2,3\n4,5,6';
      expect(parseCSV(text)).toMatchSnapshot();
    });

    it('should generate a header and fix widths', () => {
      const text = '1\n2,3,4\n5,6';
      const table = parseCSV(text, {
        headerIsFirstLine: false,
      });
      expect(table.rows.length).toBe(3);

      expect(table).toMatchSnapshot();
    });
  });
});
