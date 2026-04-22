import { type Extension } from '@uiw/react-codemirror';
import { useEffect, useState } from 'react';

import { loadLanguageExtension, type CodeEditorLanguage } from './languageLoader';

export function useLanguageExtension(language?: CodeEditorLanguage): Extension | null {
  const [languageExtension, setLanguageExtension] = useState<Extension | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!language) {
      setLanguageExtension(null);
      return;
    }

    setLanguageExtension(null);

    void loadLanguageExtension(language)
      .then((extension) => {
        if (!cancelled) {
          setLanguageExtension(extension);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLanguageExtension(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  return languageExtension;
}
