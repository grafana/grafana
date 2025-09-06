import { isValidLocale, sanitizeLocales, getSafeNavigatorLocales, createSafeDateTimeFormat } from './locale-utils';

describe('locale-utils', () => {
  describe('isValidLocale', () => {
    it('should return true for valid locales', () => {
      expect(isValidLocale('en-US')).toBe(true);
      expect(isValidLocale('de-DE')).toBe(true);
      expect(isValidLocale('fr')).toBe(true);
      expect(isValidLocale('zh-Hans')).toBe(true);
    });

    it('should return false for invalid locales', () => {
      expect(isValidLocale('c')).toBe(false);
      expect(isValidLocale('C.UTF-8')).toBe(false);
      expect(isValidLocale('invalid-locale')).toBe(false);
      expect(isValidLocale('')).toBe(false);
      expect(isValidLocale('123')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(isValidLocale(undefined as any)).toBe(false);
      expect(isValidLocale(null as any)).toBe(false);
      expect(isValidLocale(123 as any)).toBe(false);
    });
  });

  describe('sanitizeLocales', () => {
    it('should filter out invalid locales', () => {
      const locales = ['en-US', 'c', 'de-DE', 'invalid', 'fr-FR'];
      const result = sanitizeLocales(locales);
      expect(result).toEqual(['en-US', 'de-DE', 'fr-FR']);
    });

    it('should return fallback when no valid locales', () => {
      const locales = ['c', 'invalid', 'C.UTF-8'];
      const result = sanitizeLocales(locales);
      expect(result).toEqual(['en-US']);
    });

    it('should return fallback for non-array input', () => {
      expect(sanitizeLocales(undefined as any)).toEqual(['en-US']);
      expect(sanitizeLocales(null as any)).toEqual(['en-US']);
    });

    it('should use custom fallback', () => {
      const locales = ['c', 'invalid'];
      const result = sanitizeLocales(locales, 'de-DE');
      expect(result).toEqual(['de-DE']);
    });
  });

  describe('getSafeNavigatorLocales', () => {
    let originalNavigator: Navigator;

    beforeEach(() => {
      originalNavigator = global.navigator;
    });

    afterEach(() => {
      global.navigator = originalNavigator;
    });

    it('should return safe locales from navigator.languages', () => {
      global.navigator = {
        ...originalNavigator,
        languages: ['en-US', 'c', 'de-DE', 'invalid'],
      } as Navigator;

      const result = getSafeNavigatorLocales();
      expect(result).toEqual(['en-US', 'de-DE']);
    });

    it('should return fallback when navigator.languages is invalid', () => {
      global.navigator = {
        ...originalNavigator,
        languages: ['c', 'invalid', 'C.UTF-8'],
      } as Navigator;

      const result = getSafeNavigatorLocales();
      expect(result).toEqual(['en-US']);
    });

    it('should return fallback when navigator is undefined', () => {
      global.navigator = undefined as any;
      const result = getSafeNavigatorLocales();
      expect(result).toEqual(['en-US']);
    });

    it('should return fallback when navigator.languages is undefined', () => {
      global.navigator = {
        ...originalNavigator,
        languages: undefined,
      } as Navigator;

      const result = getSafeNavigatorLocales();
      expect(result).toEqual(['en-US']);
    });
  });

  describe('createSafeDateTimeFormat', () => {
    it('should create DateTimeFormat with valid locales', () => {
      const result = createSafeDateTimeFormat(['en-US', 'de-DE']);
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });

    it('should filter out invalid locales', () => {
      const result = createSafeDateTimeFormat(['en-US', 'c', 'de-DE']);
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });

    it('should use fallback when all locales are invalid', () => {
      const result = createSafeDateTimeFormat(['c', 'invalid'], undefined, 'de-DE');
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });

    it('should handle single locale string', () => {
      const result = createSafeDateTimeFormat('en-US');
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });

    it('should handle invalid single locale', () => {
      const result = createSafeDateTimeFormat('c');
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });

    it('should handle undefined locale', () => {
      const result = createSafeDateTimeFormat(undefined);
      expect(result).toBeInstanceOf(Intl.DateTimeFormat);
    });
  });
});
