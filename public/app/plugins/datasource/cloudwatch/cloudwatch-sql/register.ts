import { Monaco } from '@grafana/ui';
import { CompletionItemProvider } from './completion/CompletionItemProvider';
import language from './definition';

export const registerLanguage = (monaco: Monaco, sqlCompletionItemProvider: CompletionItemProvider) => {
  const { id, loader } = language;

  const languages = monaco.languages.getLanguages();
  if (languages.find((l) => l.id === id)) {
    return;
  }

  monaco.languages.register({ id });
  loader().then((monarch) => {
    monaco.languages.setMonarchTokensProvider(id, monarch.language);
    monaco.languages.setLanguageConfiguration(id, monarch.conf);
    monaco.languages.registerCompletionItemProvider(id, sqlCompletionItemProvider.getCompletionProvider(monaco));
  });
};
