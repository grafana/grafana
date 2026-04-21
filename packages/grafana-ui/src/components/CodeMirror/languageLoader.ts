import type { Extension } from '@uiw/react-codemirror';

type LanguageLoader = () => Promise<Extension>;

const loadJson: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-json" */ '@codemirror/lang-json')).json();
const loadSql: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-sql" */ '@codemirror/lang-sql')).sql();

const languageLoaders = {
  json: loadJson,
  sql: loadSql,
} satisfies Record<string, LanguageLoader>;

export type CodeEditorLanguage = keyof typeof languageLoaders;

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
