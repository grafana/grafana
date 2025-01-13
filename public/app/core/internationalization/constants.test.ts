import { uniqBy } from 'lodash';

import {
  BRAZILIAN_PORTUGUESE,
  CHINESE_SIMPLIFIED,
  DEFAULT_LANGUAGE,
  ENGLISH_US,
  FRENCH_FRANCE,
  GERMAN_GERMANY,
  LANGUAGES,
  PSEUDO_LOCALE,
  SPANISH_SPAIN,
  VALID_LANGUAGES,
} from './constants';

describe('internationalization constants', () => {
  it('should have set the constants correctly', () => {
    expect(ENGLISH_US).toBe('en-US');
    expect(FRENCH_FRANCE).toBe('fr-FR');
    expect(SPANISH_SPAIN).toBe('es-ES');
    expect(GERMAN_GERMANY).toBe('de-DE');
    expect(BRAZILIAN_PORTUGUESE).toBe('pt-BR');
    expect(CHINESE_SIMPLIFIED).toBe('zh-Hans');
    expect(PSEUDO_LOCALE).toBe('pseudo');
    expect(DEFAULT_LANGUAGE).toBe(ENGLISH_US);
  });

  it('should match a canonical locale definition', () => {
    for (const lang of LANGUAGES) {
      const resolved = Intl.getCanonicalLocales(lang.code);
      expect(lang.code).toEqual(resolved[0]);
    }
  });

  it('should not have duplicate languages codes', () => {
    const uniqLocales = uniqBy(LANGUAGES, (v) => v.code);
    expect(LANGUAGES).toHaveLength(uniqLocales.length);
  });

  it('should have a correct list of valid locale codes', () => {
    expect(VALID_LANGUAGES).toEqual(LANGUAGES.map((v) => v.code));
  });
});
