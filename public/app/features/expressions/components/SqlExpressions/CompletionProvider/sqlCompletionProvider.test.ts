import { getSqlCompletionProvider } from './sqlCompletionProvider';

describe('getSqlCompletionProvider', () => {
  const mockMonaco = {} as any;
  const mockLanguage = {} as any;

  it('quotes table names with spaces in completion text', async () => {
    const provider = getSqlCompletionProvider({
      getFields: jest.fn(),
      refIds: [{ value: 'gdp per capita', label: 'gdp per capita' }],
    });

    const result = provider(mockMonaco, mockLanguage);
    const tables = await result.tables!.resolve!();

    expect(tables).toHaveLength(1);
    expect(tables![0].name).toBe('gdp per capita');
    expect(tables![0].completion).toBe('`gdp per capita`');
  });

  it('does not quote simple table names', async () => {
    const provider = getSqlCompletionProvider({
      getFields: jest.fn(),
      refIds: [{ value: 'A', label: 'A' }],
    });

    const result = provider(mockMonaco, mockLanguage);
    const tables = await result.tables!.resolve!();

    expect(tables).toHaveLength(1);
    expect(tables![0].name).toBe('A');
    expect(tables![0].completion).toBe('A');
  });
});
