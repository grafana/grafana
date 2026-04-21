import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { memo, useEffect, useMemo, useState } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import { loadLanguageExtension, type CodeEditorLanguage } from './languageLoader';

export type CodeEditorCompletionMode = 'override' | 'merge';

export interface CodeEditorProps {
  value: string;
  language?: CodeEditorLanguage;
  height?: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /**
   * Autocomplete sources. When provided, enables autocompletion with the given sources.
   */
  completionSources?: readonly CompletionSource[];
  /**
   * Controls how `completionSources` integrate with language-default completions:
   * - `'merge'` (default) — add the sources alongside any language defaults.
   * - `'override'` — replace any language-default completions with just these sources.
   */
  completionMode?: CodeEditorCompletionMode;
  /**
   * Additional CodeMirror extensions to layer on top of the defaults.
   * Use this for linting, custom keymaps, themes, etc.
   */
  extensions?: Extension[];
}

const getCompletionExtensions = (
  sources: readonly CompletionSource[] | undefined,
  mode: CodeEditorCompletionMode
): Extension[] => {
  if (!sources || sources.length === 0) {
    return [];
  }

  if (mode === 'override') {
    return [autocompletion({ override: [...sources] })];
  }

  // Merge: enable autocompletion and contribute the sources via language data
  // so they're combined with whatever the active language registers.
  return [autocompletion(), ...sources.map((source) => EditorState.languageData.of(() => [{ autocomplete: source }]))];
};

const getAccessibilityExtensions = (ariaLabel: string | undefined, ariaLabelledby: string | undefined): Extension[] => {
  if (!ariaLabel && !ariaLabelledby) {
    return [];
  }

  return [
    EditorView.contentAttributes.of({
      ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      ...(ariaLabelledby ? { 'aria-labelledby': ariaLabelledby } : {}),
    }),
  ];
};

type LoadedLanguageState = {
  language?: CodeEditorLanguage;
  extension: Extension | null;
};

const emptyLanguageState: LoadedLanguageState = { extension: null };

export const CodeEditor = memo(function CodeEditor({
  value,
  language,
  height = '200px',
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  completionSources,
  completionMode = 'merge',
  extensions: additionalExtensions,
}: CodeEditorProps) {
  const theme = useTheme2();
  const [loadedLanguageState, setLoadedLanguageState] = useState<LoadedLanguageState>(emptyLanguageState);

  useEffect(() => {
    let cancelled = false;

    if (!language) {
      setLoadedLanguageState(emptyLanguageState);
      return;
    }

    setLoadedLanguageState(emptyLanguageState);

    void loadLanguageExtension(language)
      .then((extension) => {
        if (!cancelled) {
          setLoadedLanguageState({ language, extension });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedLanguageState(emptyLanguageState);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const languageExtension = loadedLanguageState.language === language ? loadedLanguageState.extension : null;

  const extensions = useMemo(
    () => [
      ...getAccessibilityExtensions(ariaLabel, ariaLabelledby),
      ...(languageExtension ? [languageExtension] : []),
      ...getCompletionExtensions(completionSources, completionMode),
      ...(additionalExtensions ?? []),
    ],
    [ariaLabel, ariaLabelledby, languageExtension, completionSources, completionMode, additionalExtensions]
  );
  return (
    <CodeMirror
      theme={theme.isDark ? vscodeDark : vscodeLight}
      value={value}
      height={height}
      extensions={extensions}
      onChange={(nextValue) => onChange(nextValue)}
    />
  );
});
