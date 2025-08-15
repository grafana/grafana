import { getCloneKey } from './clone';

describe('clone', () => {
  describe('getCloneKey', () => {
    it('should return the clone key', () => {
      expect(getCloneKey('panel', 1)).toBe('panel-clone-1');
      expect(getCloneKey('panel-clone-2', 1)).toBe('panel-clone-1');
    });

    it('should not alter ancestors', () => {
      expect(getCloneKey('row-clone-1/panel', 2)).toBe('row-clone-1/panel-clone-2');
      expect(getCloneKey('tab-clone-0/row-clone-1/panel', 2)).toBe('tab-clone-0/row-clone-1/panel-clone-2');
      expect(getCloneKey('row-clone-1/panel-clone-3', 2)).toBe('row-clone-1/panel-clone-2');
      expect(getCloneKey('tab-clone-0/row-clone-1/panel-clone-3', 2)).toBe('tab-clone-0/row-clone-1/panel-clone-2');
    });
  });
});
