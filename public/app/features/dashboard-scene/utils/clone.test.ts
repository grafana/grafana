import {
  getCloneKey,
  getOriginalKey,
  isInCloneChain,
  isClonedKey,
  joinCloneKeys,
  containsCloneKey,
  getLastKeyFromClone,
  isClonedKeyOf,
} from './clone';

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

  describe('getOriginalKey', () => {
    it('should return the original key', () => {
      expect(getOriginalKey('panel')).toBe('panel');
      expect(getOriginalKey('panel-clone-1')).toBe('panel');
      expect(getOriginalKey('row-clone-1/panel-clone-2')).toBe('panel');
      expect(getOriginalKey('tab-clone-0/row-clone-1/panel-clone-2')).toBe('panel');
      expect(getOriginalKey('panel-2-clone-3')).toBe('panel-2');
      expect(getOriginalKey('panel-2')).toBe('panel-2');
    });
  });

  describe('isClonedKey', () => {
    it('should return true for cloned keys', () => {
      expect(isClonedKey('tab-clone-0/row-clone-1/panel-clone-2')).toBe(true);
      expect(isClonedKey('row-clone-0/panel-clone-1')).toBe(true);
      expect(isClonedKey('panel-clone-1')).toBe(true);
    });

    it('should return false for non-cloned keys', () => {
      expect(isClonedKey('panel-clone-0')).toBe(false);
      expect(isClonedKey('tab-clone-1/row-clone-2/panel-clone-0')).toBe(false);
      expect(isClonedKey('row-clone-1/panel-clone-0')).toBe(false);
      expect(isClonedKey('panel')).toBe(false);
      expect(isClonedKey('tab-clone-1/row-clone-2/panel')).toBe(false);
      expect(isClonedKey('row-clone-1/panel')).toBe(false);
    });

    it('should properly handle indexes containing 0', () => {
      expect(isClonedKey('tab-clone-0/row-clone-1/panel-clone-0')).toBe(false);
      expect(isClonedKey('row-clone-0/panel-clone-0')).toBe(false);
      expect(isClonedKey('panel-clone-0')).toBe(false);

      expect(isClonedKey('tab-clone-0/row-clone-1/panel-clone-101')).toBe(true);
      expect(isClonedKey('row-clone-0/panel-clone-101')).toBe(true);
      expect(isClonedKey('panel-clone-1010')).toBe(true);

      expect(isClonedKey('tab-clone-0/row-clone-1/panel-clone-10')).toBe(true);
      expect(isClonedKey('row-clone-0/panel-clone-100')).toBe(true);
      expect(isClonedKey('panel-clone-1000')).toBe(true);
    });
  });

  describe('isClonedKeyOf', () => {
    it('should return true for cloned keys', () => {
      expect(isClonedKeyOf('tab-clone-0/row-clone-1/panel-clone-2', 'panel-clone-2')).toBe(true);
      expect(isClonedKeyOf('tab-clone-0/row-clone-1/panel-clone-2', 'panel')).toBe(true);
      expect(isClonedKeyOf('panel-clone-2', 'panel-clone-2')).toBe(true);
      expect(isClonedKeyOf('panel-clone-2', 'panel')).toBe(true);
    });

    it('should return false for non-cloned keys', () => {
      expect(isClonedKeyOf('tab-clone-0/row-clone-1/panel-clone-2', 'panel2-clone-2')).toBe(false);
      expect(isClonedKeyOf('tab-clone-0/row-clone-1/panel-clone-2', 'panel2')).toBe(false);
      expect(isClonedKeyOf('panel-clone-2', 'panel2-clone-2')).toBe(false);
      expect(isClonedKeyOf('panel-clone-2', 'panel2')).toBe(false);
    });
  });

  describe('isInCloneChain', () => {
    it('should return true for keys with cloned ancestors', () => {
      expect(isInCloneChain('tab-clone-1/row-clone-0/panel-clone-0')).toBe(true);
      expect(isInCloneChain('row-clone-0/row-clone-1/panel-clone-0')).toBe(true);
      expect(isInCloneChain('row-clone-0/row-clone-0/panel-clone-1')).toBe(true);
      expect(isInCloneChain('panel-clone-1')).toBe(true);
    });

    it('should return false for keys without cloned ancestors', () => {
      expect(isInCloneChain('panel-clone-0')).toBe(false);
      expect(isInCloneChain('row-clone-0/panel-clone-0')).toBe(false);
      expect(isInCloneChain('tab-clone-0/row-clone-0/panel-clone-0')).toBe(false);
      expect(isInCloneChain('panel')).toBe(false);
      expect(isInCloneChain('tab-clone-0/row-clone-0/panel')).toBe(false);
      expect(isInCloneChain('tab-clone-0/row/panel')).toBe(false);
      expect(isInCloneChain('tab-clone-0/row/panel-0')).toBe(false);
      expect(isInCloneChain('tab/row-clone-0/panel-0')).toBe(false);
      expect(isInCloneChain('row-clone-0/panel')).toBe(false);
    });
  });

  describe('getLastKeyFromClone', () => {
    it('should return the last key', () => {
      expect(getLastKeyFromClone('tab-clone-1/row-clone-2/panel-clone-3')).toBe('panel-clone-3');
      expect(getLastKeyFromClone('row-clone-1/panel-clone-2')).toBe('panel-clone-2');
      expect(getLastKeyFromClone('row-clone-1/panel')).toBe('panel');
      expect(getLastKeyFromClone('panel')).toBe('panel');
    });
  });

  describe('joinCloneKeys', () => {
    it('should join keys with a separator', () => {
      expect(joinCloneKeys('row', 'panel-clone-1')).toBe('row/panel-clone-1');
    });
  });

  describe('containsCloneKey', () => {
    it('should return true for keys with clone key', () => {
      expect(containsCloneKey('row-clone-0/panel-clone-1')).toBe(true);
      expect(containsCloneKey('tab-clone-0/row-clone-1/panel-clone-2')).toBe(true);
      expect(containsCloneKey('panel-clone-1')).toBe(true);
    });

    it('should return false for keys without clone key', () => {
      expect(containsCloneKey('panel')).toBe(false);
      expect(containsCloneKey('tab-0/row-1/panel-2')).toBe(false);
      expect(containsCloneKey('row-1/panel-2')).toBe(false);
    });
  });
});
