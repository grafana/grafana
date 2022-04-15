import { translateMatrixIndex } from './utils';

describe('matrix', () => {
  describe('translates indicies between two bucket sizes properly', () => {
    it('translates when bucketFrom is smaller than bucketTo', () => {
      expect(translateMatrixIndex(12, 5, 10)).toEqual(22);
      expect(translateMatrixIndex(14, 5, 10)).toEqual(24);
      expect(translateMatrixIndex(16, 5, 10)).toEqual(31);
    });
    it('translates when bucketFrom is larger than bucketTo', () => {
      expect(translateMatrixIndex(14, 12, 10)).toEqual(12);
      expect(translateMatrixIndex(16, 12, 10)).toEqual(14);
      expect(translateMatrixIndex(18, 12, 10)).toEqual(16);
    });
    it('filters out items that cannot be translated', () => {
      expect(translateMatrixIndex(10, 12, 10)).toEqual(-1);
    });
  });
});
