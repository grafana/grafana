import { type CodeMirrorEditorLanguage, type CodeMirrorExtension } from './types';

type LanguageLoader = () => Promise<CodeMirrorExtension>;

const loadJson: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-lang-json" */ '@codemirror/lang-json')).json();
const loadSql: LanguageLoader = async () =>
  (await import(/* webpackChunkName: "codemirror-lang-sql" */ '@codemirror/lang-sql')).sql();

const languageLoaders: Record<CodeMirrorEditorLanguage, LanguageLoader> = {
  json: loadJson,
  sql: loadSql,
};

const languagePromises = new Map<CodeMirrorEditorLanguage, Promise<CodeMirrorExtension>>();

export async function loadLanguageExtension(language?: CodeMirrorEditorLanguage): Promise<CodeMirrorExtension | null> {
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
