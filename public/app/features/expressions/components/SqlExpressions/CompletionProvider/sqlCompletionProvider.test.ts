import { getSqlCompletionProvider } from './sqlCompletionProvider';

describe('getSqlCompletionProvider', () => {
  it('should quote table completions when they contain spaces', async () => {
    const getFields = jest.fn();
    const refIds = [
      { value: 'A', label: 'gdp per capita' },
      { value: 'B', label: 'normal_table' },
    ];
    
    const providerGetter = getSqlCompletionProvider({ getFields, refIds } as any);
    const provider = providerGetter({} as any, { id: 'sql' } as any);
    
    const resolveFunc = provider.tables?.resolve;
    expect(resolveFunc).toBeDefined();
    
    if (resolveFunc) {
      const tables = await resolveFunc(null);
      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual(expect.objectContaining({
        name: 'gdp per capita',
        completion: '`gdp per capita`',
      }));
      expect(tables[1]).toEqual(expect.objectContaining({
        name: 'normal_table',
        completion: 'normal_table',
      }));
    }
  });

  it('should use label if provided, otherwise value for table name', async () => {
    const getFields = jest.fn();
    const refIds = [
      { value: 'value_only' },
      { value: 'A', label: 'Label A' },
    ];
    
    const providerGetter = getSqlCompletionProvider({ getFields, refIds } as any);
    const provider = providerGetter({} as any, { id: 'sql' } as any);
    const resolveFunc = provider.tables?.resolve;
    
    if (resolveFunc) {
      const tables = await resolveFunc(null);
      expect(tables[0].name).toBe('value_only');
      expect(tables[1].name).toBe('Label A');
    }
  });

  it('should not double-quote already quoted table completions', async () => {
    const getFields = jest.fn();
    const refIds = [{ value: '`already quoted`' }];
    
    const providerGetter = getSqlCompletionProvider({ getFields, refIds } as any);
    const provider = providerGetter({} as any, { id: 'sql' } as any);
    const resolveFunc = provider.tables?.resolve;
    
    if (resolveFunc) {
      const tables = await resolveFunc(null);
      expect(tables[0].completion).toBe('`already quoted`');
    }
  });
});
