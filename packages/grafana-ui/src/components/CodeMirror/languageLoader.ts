import type { Extension } from '@uiw/react-codemirror';

type LanguageLoader = () => Promise<Extension>;

const loadJson: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-json" */ '@codemirror/lang-json')).json();
const loadSql: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-sql" */ '@codemirror/lang-sql')).sql();

export type CodeEditorLanguage = 'json' | 'sql';

const languageLoaders: Record<CodeEditorLanguage, LanguageLoader> = {
  json: loadJson,
  sql: loadSql,
};

const languagePromises = new Map<CodeEditorLanguage, Promise<Extension>>();

export async function loadLanguageExtension(language?: CodeEditorLanguage): Promise<Extension | null> {
  if (!language) {
    return null;
  }

  const promise =
    languagePromises.get(language) ??
    languageLoaders[language]().catch((error) => {
      languagePromises.delete(language);
      throw error;
    });

  languagePromises.set(language, promise);
  return promise;
}
