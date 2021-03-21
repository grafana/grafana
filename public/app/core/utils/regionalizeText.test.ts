import { regionalizeText } from './regionalizeText';

describe('regionalizeText', () => {
  /**
   * window.navigator and its properties are read-only
   * https://developer.mozilla.org/en-US/docs/Web/API/Navigator
   *
   * mock per https://stackoverflow.com/questions/52868727/how-to-mock-window-navigator-language-using-jest
   */
  let languageGetter: jest.SpyInstance;
  beforeEach(() => {
    languageGetter = jest.spyOn(window.navigator, 'language', 'get');
  });

  describe('word that does not change based on region', () => {
    it('returns the same text as passed to the function', () => {
      const regionalizedTest = regionalizeText('conor');
      expect(regionalizedTest).toBe('conor');
    });
  });

  describe('word that changes based on region', () => {
    describe('user language is en-US', () => {
      it('translates -ising to -izing', () => {
        const regionalizedTest = regionalizeText('democratising');
        expect(regionalizedTest).toBe('democratizing');
      });
    });

    describe('user language is not en-US', () => {
      it('translates -izing to -ising', () => {
        languageGetter.mockReturnValue('en-GB');
        const regionalizedTest = regionalizeText('democratizing');
        expect(regionalizedTest).toBe('democratising');
      });
    });
  });
});
