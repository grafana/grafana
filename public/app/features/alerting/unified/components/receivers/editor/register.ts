import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

import { Monaco } from '@grafana/ui';

export type LanguageDefinition = {
  id: string;
  extensions: string[];
  aliases: string[];
  mimetypes: string[];
  loader: () => Promise<{
    language: monacoType.languages.IMonarchLanguage;
    conf: monacoType.languages.LanguageConfiguration;
  }>;
};

export const registerLanguage = (
  monaco: Monaco,
  language: LanguageDefinition
  // completionItemProvider: Completeable
) => {
  const { id, loader } = language;

  const languages = monaco.languages.getLanguages();
  if (languages.find((l) => l.id === id)) {
    return;
  }

  monaco.languages.register({ id });
  loader().then((monarch) => {
    monaco.languages.setMonarchTokensProvider(id, monarch.language);
    monaco.languages.setLanguageConfiguration(id, monarch.conf);
    // monaco.languages.registerCompletionItemProvider(id, completionItemProvider.getCompletionProvider(monaco, language));
  });
};
