import { formatFileTypes } from './utils';

describe('Dataframe import / Utils', () => {
  describe('formatFileTypes', () => {
    it('should nicely format file extensions', () => {
      expect(
        formatFileTypes({
          'text/plain': ['.csv', '.txt'],
          'application/json': ['.json'],
        })
      ).toBe('.csv, .txt or .json');
    });

    it('should remove duplicates', () => {
      expect(
        formatFileTypes({
          'text/plain': ['.csv', '.txt'],
          'application/json': ['.json', '.txt'],
        })
      ).toBe('.csv, .txt or .json');
    });

    it('should nicely format a single file type extension', () => {
      expect(
        formatFileTypes({
          'text/plain': ['.txt'],
        })
      ).toBe('.txt');
    });

    it('should nicely format two file type extension', () => {
      expect(
        formatFileTypes({
          'text/plain': ['.txt', '.csv'],
        })
      ).toBe('.txt or .csv');
    });
  });
});
