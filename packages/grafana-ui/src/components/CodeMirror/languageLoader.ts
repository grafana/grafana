import { type CodeMirrorEditorLanguage, type CodeMirrorExtension, type CodeMirrorSqlDialect } from './types';

type LanguageLoader = (sqlDialect: CodeMirrorSqlDialect) => Promise<CodeMirrorExtension>;

const loadJson: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-lang-json" */ '@codemirror/lang-json')).json();
const loadSql: LanguageLoader = async (sqlDialect) => {
  const { sql, MySQL } = await import(/* webpackChunkName: "codemirror-lang-sql" */ '@codemirror/lang-sql');
  return sql(sqlDialect === 'mysql' ? { dialect: MySQL } : undefined);
};

const languageLoaders: Record<CodeMirrorEditorLanguage, LanguageLoader> = {
  json: loadJson,
  sql: loadSql,
};

const DEFAULT_SQL_DIALECT: CodeMirrorSqlDialect = 'standard';

// Cache per language + dialect so switching dialects loads the matching parser.
const languagePromises = new Map<string, Promise<CodeMirrorExtension>>();

export async function loadLanguageExtension(
  language?: CodeMirrorEditorLanguage,
  sqlDialect: CodeMirrorSqlDialect = DEFAULT_SQL_DIALECT
): Promise<CodeMirrorExtension | null> {
  if (!language) {
    return null;
  }

  const cacheKey = `${language}:${sqlDialect}`;
  const promise =
    languagePromises.get(cacheKey) ??
    languageLoaders[language](sqlDialect).catch((error) => {
      languagePromises.delete(cacheKey);
      throw error;
    });

  languagePromises.set(cacheKey, promise);
  return promise;
}
