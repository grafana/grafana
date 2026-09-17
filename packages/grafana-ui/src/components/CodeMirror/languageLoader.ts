import { type SQLDialect } from '@codemirror/lang-sql';

import { type CodeMirrorEditorLanguage, type CodeMirrorExtension, type CodeMirrorSqlDialect } from './types';

const DEFAULT_SQL_DIALECT: CodeMirrorSqlDialect = 'standardSql';

const loadGo = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-go" */ '@codemirror/lang-go')).go();

const loadHtml = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-html" */ '@codemirror/lang-html')).html();

const loadJson = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-json" */ '@codemirror/lang-json')).json();

const loadMarkdown = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-markdown" */ '@codemirror/lang-markdown')).markdown();

const loadTypescript = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-javascript" */ '@codemirror/lang-javascript')).javascript({
    typescript: true,
  });

const loadXml = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-xml" */ '@codemirror/lang-xml')).xml();

const loadYaml = async (): Promise<CodeMirrorExtension> =>
  (await import(/* webpackChunkName: "codemirror-lang-yaml" */ '@codemirror/lang-yaml')).yaml();

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
    case 'go':
      return { cacheKey: 'go', load: loadGo };
    case 'html':
      return { cacheKey: 'html', load: loadHtml };
    case 'json':
      return { cacheKey: 'json', load: loadJson };
    case 'markdown':
      return { cacheKey: 'markdown', load: loadMarkdown };
    case 'sql': {
      const dialect = options.sqlDialect ?? DEFAULT_SQL_DIALECT;
      return { cacheKey: `sql:${dialect}`, load: () => loadSql(dialect) };
    }
    case 'typescript':
      return { cacheKey: 'typescript', load: loadTypescript };
    case 'xml':
      return { cacheKey: 'xml', load: loadXml };
    case 'yaml':
      return { cacheKey: 'yaml', load: loadYaml };
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
