import { isRelativeFormat } from './validator';

describe('validator', () => {
  describe('isRelativeFormat', () => {
    it('should consider now as a relative format', () => {
      expect(isRelativeFormat('now')).toBe(true);
    });

    it('should consider now-10s as a relative format', () => {
      expect(isRelativeFormat('now-10s')).toBe(true);
    });

    it('should consider now-2000m as a relative format', () => {
      expect(isRelativeFormat('now-2000m')).toBe(true);
    });

    it('should consider now-112334h as a relative format', () => {
      expect(isRelativeFormat('now-112334h')).toBe(true);
    });

    it('should consider now-12d as a relative format', () => {
      expect(isRelativeFormat('now-12d')).toBe(true);
    });

    it('should consider now-53w as a relative format', () => {
      expect(isRelativeFormat('now-53w')).toBe(true);
    });

    it('should consider now-9M as a relative format', () => {
      expect(isRelativeFormat('now-9M')).toBe(true);
    });

    it('should consider now+9M as a relative format', () => {
      expect(isRelativeFormat('now+9M')).toBe(false);
    });

    it('should consider asdfnow-9M as a relative format', () => {
      expect(isRelativeFormat('asdfnow-9M')).toBe(false);
    });

    it('should consider 123123123 as a relative format', () => {
      expect(isRelativeFormat('123123123')).toBe(false);
    });
  });
});
