import { getStylesheetEntries, hasThemeStylesheets } from './loaders';

describe('Loaders', () => {
  describe('stylesheet helpers', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('getStylesheetEntries', () => {
      it('returns entries for dark and light theme', () => {
        const result = getStylesheetEntries(`${__dirname}/../mocks/stylesheetsSupport/ok`);
        expect(Object.keys(result)).toHaveLength(2);
      });
      it('throws on theme files duplicates', () => {
        const result = () => {
          getStylesheetEntries(`${__dirname}/../mocks/stylesheetsSupport/duplicates`);
        };
        expect(result).toThrow();
      });
    });

    describe('hasThemeStylesheets', () => {
      it('throws when only one theme file is defined', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();
        const result = () => {
          hasThemeStylesheets(`${__dirname}/../mocks/stylesheetsSupport/missing-theme-file`);
        };
        expect(result).toThrow();
        errorSpy.mockRestore();
      });

      it('returns false when no theme files present', () => {
        const result = hasThemeStylesheets(`${__dirname}/../mocks/stylesheetsSupport/no-theme-files`);

        expect(result).toBeFalsy();
      });

      it('returns true when theme files present', () => {
        const result = hasThemeStylesheets(`${__dirname}/../mocks/stylesheetsSupport/ok`);

        expect(result).toBeTruthy();
      });
    });
  });
});
