import { getStylesheetEntries } from './loaders';

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
  });
});
