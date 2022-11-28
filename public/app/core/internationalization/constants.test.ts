import { uniqBy } from 'lodash';

import { LANGUAGES, VALID_LANGUAGES } from './constants';

describe('internationalization constants', () => {
  it('should not have duplicate languages codes', () => {
    const uniqLocales = uniqBy(LANGUAGES, (v) => v.code);
    expect(LANGUAGES).toHaveLength(uniqLocales.length);
  });

  it('should have a correct list of valid locale codes', () => {
    expect(VALID_LANGUAGES).toEqual(LANGUAGES.map((v) => v.code));
  });
});
