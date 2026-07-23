jest.mock('@codemirror/lang-sql', () => {
  const actual = jest.requireActual('@codemirror/lang-sql');
  return {
    ...actual,
    sql: jest.fn((config) => actual.sql(config)),
  };
});

// The language loader memoizes extensions in a module-level cache, so each test
// runs with an isolated module registry to exercise loading fresh.
describe('loadLanguageExtension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no language is provided', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      await expect(loadLanguageExtension(undefined)).resolves.toBeNull();
    });
  });

  it('defaults the SQL dialect to StandardSQL', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql');

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: true });
    });
  });

  it('uses the StandardSQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: true });
    });
  });

  it('uses the MySQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, MySQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'mySql' });

      expect(sql).toHaveBeenCalledWith({ dialect: MySQL, upperCaseKeywords: true });
    });
  });

  it('adds indentation-based folding to SQL', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { foldable } = await import('@codemirror/language');
      const { EditorState } = await import('@codemirror/state');
      const extension = await loadLanguageExtension('sql');
      const state = EditorState.create({
        doc: 'FROM\n  table_a\nWHERE one > 0',
        extensions: extension ? [extension] : [],
      });
      const fromLine = state.doc.line(1);

      expect(foldable(state, fromLine.from, fromLine.to)).toEqual({ from: 4, to: 14 });
    });
  });

  it('loads and memoizes each SQL dialect independently', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');

      const standard = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });
      const mySql = await loadLanguageExtension('sql', { sqlDialect: 'mySql' });
      const standardAgain = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(standard).not.toBe(mySql);
      expect(standardAgain).toBe(standard);
    });
  });

  it.each(['go', 'html', 'json', 'markdown', 'typescript', 'xml', 'yaml'] as const)(
    'loads and memoizes the %s extension',
    async (language) => {
      await jest.isolateModulesAsync(async () => {
        const { loadLanguageExtension } = await import('./languageLoader');

        const extension = await loadLanguageExtension(language);
        const again = await loadLanguageExtension(language);

        expect(extension).not.toBeNull();
        expect(again).toBe(extension);
      });
    }
  );

  it('configures the typescript loader for TypeScript syntax', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { typescriptLanguage } = await import('@codemirror/lang-javascript');

      const extension = await loadLanguageExtension('typescript');

      expect(extension).toHaveProperty('language', typescriptLanguage);
    });
  });
});
