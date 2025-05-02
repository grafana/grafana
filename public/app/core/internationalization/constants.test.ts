import { uniqBy } from 'lodash';

import { LANGUAGES, VALID_LANGUAGES } from './constants';

describe('internationalization constants', () => {
  it('should match a canonical locale definition', () => {
    for (const lang of LANGUAGES) {
      const resolved = Intl.getCanonicalLocales(lang.code);
      expect(lang.code).toEqual(resolved[0]);
    }
  });

  it('should have locale codes including the country code', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toMatch(/^[a-z]{2}-[a-zA-Z]+$/);
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
