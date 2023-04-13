import { FieldType, LogRowModel, MutableDataFrame } from '@grafana/data';

import LokiLanguageProvider from './LanguageProvider';
import { LogContextProvider } from './LogContextProvider';

const defaultLanguageProviderMock = {
  start: jest.fn(),
  getLabelKeys: jest.fn(() => ['foo']),
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
  labels: { bar: 'baz', foo: 'uniqueParsedLabel' },
  uid: '1',
} as unknown as LogRowModel;

describe('new context ui', () => {
  it('returns expression with 1 label', async () => {
    const lcp = new LogContextProvider(defaultLanguageProviderMock);
    const result = await lcp.prepareContextExpr(defaultLogRow);

    expect(result).toEqual('{foo="uniqueParsedLabel"}');
  });

  it('returns empty expression for parsed labels', async () => {
    const languageProviderMock = {
      ...defaultLanguageProviderMock,
      getLabelKeys: jest.fn(() => []),
    } as unknown as LokiLanguageProvider;

    const lcp = new LogContextProvider(languageProviderMock);
    const result = await lcp.prepareContextExpr(defaultLogRow);

    expect(result).toEqual('{}');
  });
});

describe('prepareLogRowContextQueryTarget', () => {
  const lcp = new LogContextProvider(defaultLanguageProviderMock);
  it('creates query with only labels from /labels API', async () => {
    const contextQuery = await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');

    expect(contextQuery.query.expr).toContain('uniqueParsedLabel');
    expect(contextQuery.query.expr).not.toContain('baz');
  });

  it('should call languageProvider.start to fetch labels', async () => {
    await lcp.prepareLogRowContextQueryTarget(defaultLogRow, 10, 'BACKWARD');
    expect(lcp.languageProvider.start).toBeCalled();
  });
});
