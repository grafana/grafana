import { FieldType, LogRowModel, MutableDataFrame } from '@grafana/data';

import LokiLanguageProvider from './LanguageProvider';
import { LogContextProvider } from './LogContextProvider';
import { LokiQuery } from './types';

const defaultLanguageProviderMock = {
  start: jest.fn(),
  getLabelKeys: jest.fn(() => ['bar']),
} as unknown as LokiLanguageProvider;

const defaultLogRow = {
  rowIndex: 0,
  dataFrame: new MutableDataFrame({
    fields: [
      {
        name: 'ts',
        type: FieldType.time,
        values: [0],
      },
    ],
  }),
  labels: { bar: 'baz', foo: 'uniqueParsedLabel', xyz: 'abc' },
  uid: '1',
} as unknown as LogRowModel;

describe('LogContextProvider', () => {
  let logContextProvider: LogContextProvider;
  beforeEach(() => {
    logContextProvider = new LogContextProvider(defaultLanguageProviderMock);
  });

  describe('prepareLogRowContextQueryTarget', () => {
    it('should call languageProvider.start to fetch labels', async () => {
      await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
      expect(logContextProvider.languageProvider.start).toBeCalled();
    });

    describe('with no context filters', () => {
      it('returns expression with 1 label returned by language provider', async () => {
        const result = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
        expect(result.query.expr).toEqual('{bar="baz"}');
      });

      it('returns empty expression if no label keys from language provider', async () => {
        const languageProviderMock = {
          ...defaultLanguageProviderMock,
          getLabelKeys: jest.fn(() => []),
        } as unknown as LokiLanguageProvider;

        logContextProvider = new LogContextProvider(languageProviderMock);
        const result = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
        expect(result.query.expr).toEqual('{}');
      });

      it('creates query with only labels from /labels API', async () => {
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');

        expect(contextQuery.query.expr).not.toContain('uniqueParsedLabel');
        expect(contextQuery.query.expr).toContain('baz');
      });

      it('should add parser to query if it exists in original query', async () => {
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
          expr: '{bar="baz"} | logfmt',
        } as unknown as LokiQuery);

        expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
      });

      it('should not add parser to query if more parsers in original query', async () => {
        const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
          expr: '{bar="baz"} | logfmt | json',
        } as unknown as LokiQuery);

        expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
      });

      describe('with context filters', () => {
        it('should use context filters if they exist for row', async () => {
          logContextProvider = new LogContextProvider(defaultLanguageProviderMock);
          logContextProvider.contextFilters = {
            1: [
              { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
              { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
              { value: 'xyz', enabled: true, fromParser: true, label: 'xyz' },
            ],
          };
          const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
            expr: '{bar="baz"} | logfmt',
          } as unknown as LokiQuery);

          expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | foo=\`uniqueParsedLabel\` | xyz=\`abc\``);
        });

        it('should not add parser and parsed labels using context filters if more parsers in query', async () => {
          logContextProvider = new LogContextProvider(defaultLanguageProviderMock);
          logContextProvider.contextFilters = {
            1: [
              { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
              { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
              { value: 'xyz', enabled: true, fromParser: true, label: 'xyz' },
            ],
          };
          const contextQuery = await logContextProvider.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
            expr: '{bar="baz"} | logfmt | json',
          } as unknown as LokiQuery);

          expect(contextQuery.query.expr).toEqual(`{bar="baz"}`);
        });
      });
    });
  });
});
