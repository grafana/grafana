import { LANGUAGES, VALID_LANGUAGES } from './constants';

describe('internationalization constants', () => {
  it('should have a correct list of valid locale codes', () => {
    expect(VALID_LANGUAGES).toEqual(LANGUAGES.map((v) => v.code));
  });
});
