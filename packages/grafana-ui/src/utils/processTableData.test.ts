import { parseCSV } from './processTableData';

describe('processTableData', () => {
  describe('basic processing', () => {
    it('should read header and two rows', () => {
      const simpleCSV = 'a,b,c\n1,2,3\n4,5,6';
      expect(parseCSV(simpleCSV)).toMatchSnapshot();
    });
  });
});
