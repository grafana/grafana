import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { loadLanguage, type LanguageName } from '@uiw/codemirror-extensions-langs';
import { basicDark } from '@uiw/codemirror-theme-basic';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { memo, useMemo } from 'react';

type CodeEditorLanguage = LanguageName;

export type CodeEditorCompletionMode = 'override' | 'merge';

export interface CodeEditorProps {
  value: string;
  language?: CodeEditorLanguage;
  height?: string;
  onChange: (value: string) => void;
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

const getLanguageExtensions = (language?: CodeEditorLanguage): Extension[] => {
  if (!language) {
    return [];
  }

  const extension = loadLanguage(language);
  return extension ? [extension] : [];
};

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
  return [
    autocompletion(),
    ...sources.map((source) => EditorState.languageData.of(() => [{ autocomplete: source }])),
  ];
};

export const CodeEditor = memo(function CodeEditor({
  value,
  language,
  height = '200px',
  onChange,
  completionSources,
  completionMode = 'merge',
  extensions: additionalExtensions,
}: CodeEditorProps) {
  const extensions = useMemo(
    () => [
      ...getLanguageExtensions(language),
      ...getCompletionExtensions(completionSources, completionMode),
      ...(additionalExtensions ?? []),
    ],
    [language, completionSources, completionMode, additionalExtensions]
  );

  return (
    <CodeMirror
      theme={basicDark}
      value={value}
      height={height}
      extensions={extensions}
      onChange={(nextValue) => onChange(nextValue)}
    />
  );
});
