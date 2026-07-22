import { type SQLDialect } from '@codemirror/lang-sql';

import { type CodeMirrorEditorLanguage, type CodeMirrorExtension, type CodeMirrorSqlDialect } from './types';

const DEFAULT_SQL_DIALECT: CodeMirrorSqlDialect = 'standardSql';

const loadJson = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-json" */ '@codemirror/lang-json')).json();

const loadSql = async (dialect: CodeMirrorSqlDialect): Promise<CodeMirrorExtension> => {
  const [{ sql, StandardSQL, MySQL }, { foldByIndentation }] = await Promise.all([
    import(/* webpackChunkName: "codemirror-lang-sql" */ '@codemirror/lang-sql'),
    import(/* webpackChunkName: "codemirror-lang-sql" */ './sqlFolding'),
  ]);
  const dialects: Record<CodeMirrorSqlDialect, SQLDialect> = {
    standardSql: StandardSQL,
    mySql: MySQL,
  };
  return [sql({ dialect: dialects[dialect], upperCaseKeywords: true }), foldByIndentation];
};

interface LoadLanguageOptions {
  /** SQL dialect to load. Only used when `language` is `'sql'`. */
  sqlDialect?: CodeMirrorSqlDialect;
}

// Each language resolves to a cache key and a parameterless loader. The cache
// key differentiates SQL dialects so each dialect's extension is loaded and
// memoized independently.
const resolveLoad = (
  language: CodeMirrorEditorLanguage,
  options: LoadLanguageOptions
): { cacheKey: string; load: () => Promise<CodeMirrorExtension> } => {
  switch (language) {
    case 'json':
      return { cacheKey: 'json', load: loadJson };
    case 'sql': {
      const dialect = options.sqlDialect ?? DEFAULT_SQL_DIALECT;
      return { cacheKey: `sql:${dialect}`, load: () => loadSql(dialect) };
    }
  }
};

const languagePromises = new Map<string, Promise<CodeMirrorExtension>>();

export async function loadLanguageExtension(
  language?: CodeMirrorEditorLanguage,
  options: LoadLanguageOptions = {}
): Promise<CodeMirrorExtension | null> {
  if (!language) {
    return null;
  }

  const { cacheKey, load } = resolveLoad(language, options);

  const promise =
    languagePromises.get(cacheKey) ??
    load().catch((error) => {
      languagePromises.delete(cacheKey);
      throw error;
    });

  languagePromises.set(cacheKey, promise);
  return promise;
}
