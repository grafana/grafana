import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { memo, useMemo } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { type CodeMirrorCompletionMode, type CodeMirrorCompletionSource, type CodeMirrorEditorProps } from './types';
import { useLanguageExtension } from './useLanguageExtension';

const getCompletionExtensions = (
  sources: readonly CodeMirrorCompletionSource[] | undefined,
  mode: CodeMirrorCompletionMode
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

// Bind Tab to accept completions before the default indent behavior
const autocompleteTabKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Tab',
      run: acceptCompletion,
    },
  ])
);

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
}: CodeMirrorEditorProps) {
  const theme = useTheme2();
  const { extension: languageExtension, error: languageExtensionError } = useLanguageExtension(language);

  const extensions = useMemo(
    () => [
      autocompleteTabKeymap,
      ...getAccessibilityExtensions(ariaLabel, ariaLabelledby),
      ...(languageExtension ? [languageExtension] : []),
      ...getCompletionExtensions(completionSources, completionMode),
      ...(additionalExtensions ?? []),
    ],
    [ariaLabel, ariaLabelledby, languageExtension, completionSources, completionMode, additionalExtensions]
  );
  return (
    <>
      {languageExtensionError && (
        <Alert title={t('grafana-ui.code-mirror.language-load-failed', 'Syntax highlighting failed to load')}>
          {t(
            'grafana-ui.code-mirror.language-load-failed-description',
            'The editor will continue without language-specific features.'
          )}
        </Alert>
      )}
      <CodeMirror
        theme={theme.isDark ? vscodeDark : vscodeLight}
        value={value}
        height={height}
        extensions={extensions}
        onChange={onChange}
      />
    </>
  );
});
