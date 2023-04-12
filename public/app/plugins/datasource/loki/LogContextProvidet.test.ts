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
  const lcp = new LogContextProvider(defaultLanguageProviderMock);
  describe('prepareLogRowContextQueryTarget', () => {
    it('returns expression with 1 label returned by language provider', async () => {
      const result = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
      expect(result.query.expr).toEqual('{bar="baz"}');
    });

    it('returns empty expression if no label keys from language provider', async () => {
      const languageProviderMock = {
        ...defaultLanguageProviderMock,
        getLabelKeys: jest.fn(() => []),
      } as unknown as LokiLanguageProvider;

      const lcp = new LogContextProvider(languageProviderMock);
      const result = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
      expect(result.query.expr).toEqual('{}');
    });

    it('creates query with only labels from /labels API', async () => {
      const contextQuery = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');

      expect(contextQuery.query.expr).not.toContain('uniqueParsedLabel');
      expect(contextQuery.query.expr).toContain('baz');
    });

    it('should call languageProvider.start to fetch labels', async () => {
      await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
      expect(lcp.languageProvider.start).toBeCalled();
    });

    it('should add parser to query if it exists in original query', async () => {
      const contextQuery = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
        expr: '{bar="baz"} | logfmt',
      } as unknown as LokiQuery);

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt`);
    });

    it('should use context filters if they exist for row', async () => {
      const lcp = new LogContextProvider(defaultLanguageProviderMock);
      lcp.contextFilters = {
        1: [
          { value: 'bar', enabled: true, fromParser: false, label: 'bar' },
          { value: 'foo', enabled: true, fromParser: true, label: 'foo' },
          { value: 'xyz', enabled: true, fromParser: true, label: 'xyz' },
        ],
      };
      const contextQuery = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD', {
        expr: '{bar="baz"} | logfmt',
      } as unknown as LokiQuery);

      expect(contextQuery.query.expr).toEqual(`{bar="baz"} | logfmt | foo=\`uniqueParsedLabel\` | xyz=\`abc\``);
    });
  });
});
