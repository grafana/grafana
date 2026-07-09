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

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: false });
    });
  });

  it('uses the StandardSQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: false });
    });
  });

  it('uses the MySQL dialect when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, MySQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlDialect: 'mySql' });

      expect(sql).toHaveBeenCalledWith({ dialect: MySQL, upperCaseKeywords: false });
    });
  });

  it('uses upper-case SQL keyword completions when requested', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');

      await loadLanguageExtension('sql', { sqlUpperCaseKeywords: true });

      expect(sql).toHaveBeenCalledWith({ dialect: StandardSQL, upperCaseKeywords: true });
    });
  });

  it('loads and memoizes each SQL configuration independently', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadLanguageExtension } = await import('./languageLoader');

      const standard = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });
      const mySql = await loadLanguageExtension('sql', { sqlDialect: 'mySql' });
      const standardUpperCaseKeywords = await loadLanguageExtension('sql', { sqlUpperCaseKeywords: true });
      const standardAgain = await loadLanguageExtension('sql', { sqlDialect: 'standardSql' });

      expect(standard).not.toBe(mySql);
      expect(standard).not.toBe(standardUpperCaseKeywords);
      expect(standardAgain).toBe(standard);
    });
  });
});
