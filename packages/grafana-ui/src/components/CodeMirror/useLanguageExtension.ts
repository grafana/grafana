import { useEffect, useState } from 'react';

import { faro } from '@grafana/faro-web-sdk';

import { loadLanguageExtension } from './languageLoader';
import {
  type CodeMirrorEditorLanguage,
  type CodeMirrorExtension,
  type CodeMirrorSqlDialect,
  type LoadLanguageOptions,
} from './types';

export interface LanguageExtensionState {
  extension: CodeMirrorExtension | null;
  error: Error | null;
}

export function useLanguageExtension(
  language?: CodeMirrorEditorLanguage,
  optionsOrSqlDialect?: CodeMirrorSqlDialect | LoadLanguageOptions
): LanguageExtensionState {
  const [languageExtension, setLanguageExtension] = useState<CodeMirrorExtension | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const options: LoadLanguageOptions =
    typeof optionsOrSqlDialect === 'string' ? { sqlDialect: optionsOrSqlDialect } : (optionsOrSqlDialect ?? {});
  const { sqlDialect, htmlAutocompleteEventHandlers } = options;

  useEffect(() => {
    let cancelled = false;

    if (!language) {
      setLanguageExtension(null);
      setError(null);
      return;
    }

    setLanguageExtension(null);
    setError(null);

    const loadOptions: LoadLanguageOptions = {
      sqlDialect,
      ...(htmlAutocompleteEventHandlers !== undefined ? { htmlAutocompleteEventHandlers } : {}),
    };

    void loadLanguageExtension(language, loadOptions)
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
  }, [language, sqlDialect, htmlAutocompleteEventHandlers]);

  return { extension: languageExtension, error };
}
