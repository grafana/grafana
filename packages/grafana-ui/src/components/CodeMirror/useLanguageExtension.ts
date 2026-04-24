import { type Extension } from '@uiw/react-codemirror';
import { useEffect, useState } from 'react';

import { faro } from '@grafana/faro-web-sdk';

import { loadLanguageExtension, type CodeEditorLanguage } from './languageLoader';

export interface LanguageExtensionState {
  extension: Extension | null;
  error: Error | null;
}

export function useLanguageExtension(language?: CodeEditorLanguage): LanguageExtensionState {
  const [languageExtension, setLanguageExtension] = useState<Extension | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!language) {
      setLanguageExtension(null);
      setError(null);
      return;
    }

    setLanguageExtension(null);
    setError(null);

    void loadLanguageExtension(language)
      .then((extension) => {
        if (!cancelled) {
          setLanguageExtension(extension);
          setError(null);
        }
      })
      .catch((caughtError: unknown) => {
        const error =
          caughtError instanceof Error
            ? caughtError
            : new Error('Failed to load CodeMirror language extension', { cause: caughtError });

        faro?.api?.pushError(error, {
          context: {
            type: 'async',
            source: 'CodeMirror.useLanguageExtension',
            language,
          },
        });

        if (!cancelled) {
          setLanguageExtension(null);
          setError(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return { extension: languageExtension, error };
}
