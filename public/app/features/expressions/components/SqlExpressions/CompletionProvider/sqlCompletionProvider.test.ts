import { getSqlCompletionProvider } from './sqlCompletionProvider';

describe('getSqlCompletionProvider', () => {
  it('quotes completion value when refId has spaces', async () => {
    const provider = getSqlCompletionProvider({
      getFields: jest.fn().mockResolvedValue([]),
      refIds: [{ value: 'A B' }],
    });

    const resolvedProvider = provider({}, {} as never);
    const tables = await resolvedProvider.tables.resolve();

    expect(tables).toEqual([
      {
        name: 'A B',
        completion: '`A B`',
      },
    ]);
  });
});
