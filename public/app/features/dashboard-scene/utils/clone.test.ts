import { getCloneKey } from './clone';

describe('clone', () => {
  describe('getCloneKey', () => {
    it('should return the clone key', () => {
      expect(getCloneKey('panel-1', 1)).toBe('panel-1-clone-1');
      expect(getCloneKey('panel-22', 1)).toBe('panel-22-clone-1');
    });
  });
});
