import { timeToString } from '../editor';

describe('CustomTimeRangeEditorCtrl', () => {
  describe('timeToString function', () => {
    function inputError() {
      timeToString('a', 2);
    }
    function rangeError() {
      timeToString(99, 99);
    }
    it('should work with only two numbers', () => {
      expect(timeToString(5, 2)).toEqual('05:02');
    });
    it('should return error for invalid input', () => {
      expect(inputError).toThrowError('Invalid input');
    });
    it('should return error for out of range input', () => {
      expect(rangeError).toThrowError('Invalid input');
    });
  });
});
