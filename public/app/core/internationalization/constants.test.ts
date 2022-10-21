import { uniqBy } from 'lodash';

import { LOCALES, VALID_LOCALES } from './constants';

describe('internationalization constants', () => {
  it('should not have duplicate languages codes', () => {
    const uniqLocales = uniqBy(LOCALES, (v) => v.code);
    expect(LOCALES).toHaveLength(uniqLocales.length);
  });

  it('should have a correct list of valid locale codes', () => {
    expect(VALID_LOCALES).toEqual(LOCALES.map((v) => v.code));
  });
});
