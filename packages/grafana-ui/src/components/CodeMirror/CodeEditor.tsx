import { acceptCompletion, autocompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { memo, useMemo } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { createCodeEditorTheme } from './theme';
import {
  type CodeMirrorCompletionMode,
  type CodeMirrorCompletionSource,
  type CodeMirrorEditorProps,
  type CodeMirrorExtension,
} from './types';
import { useLanguageExtension } from './useLanguageExtension';

const getCompletionExtensions = (
  sources: readonly CodeMirrorCompletionSource[] | undefined,
  mode: CodeMirrorCompletionMode
): CodeMirrorExtension[] => {
  if (!sources || sources.length === 0) {
    return [];
  }

  if (mode === 'override') {
    return [autocompletion({ override: [...sources] }), autocompleteSpaceKeymap];
  }

  // Merge: enable autocompletion and contribute the sources via language data
  // so they're combined with whatever the active language registers.
  return [
    autocompletion(),
    autocompleteSpaceKeymap,
    ...sources.map((source) => EditorState.languageData.of(() => [{ autocomplete: source }])),
  ];
};

const getAccessibilityExtensions = (
  ariaLabel: string | undefined,
  ariaLabelledby: string | undefined
): CodeMirrorExtension[] => {
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

const autocompleteSpaceKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Space',
      run: (view) => {
        if (view.state.readOnly) {
          return false;
        }

        view.dispatch(view.state.replaceSelection(' '));
        startCompletion(view);
        return true;
      },
    },
  ])
);

export const CodeEditor = memo(function CodeEditor({
  value,
  language,
  sqlDialect,
  height = '200px',
  onChange,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  completionSources,
  completionMode = 'merge',
  extensions: additionalExtensions,
  theme: themeOverride,
  basicSetup,
  indentWithTab = true,
  readOnly = false,
  lineWrapping = false,
}: CodeMirrorEditorProps) {
  const theme = useTheme2();
  const { extension: languageExtension, error: languageExtensionError } = useLanguageExtension(language, sqlDialect);
  const editorTheme = useMemo(() => createCodeEditorTheme(theme), [theme]);

  const extensions = useMemo(
    () => [
      autocompleteTabKeymap,
      ...getAccessibilityExtensions(ariaLabel, ariaLabelledby),
      ...(languageExtension ? [languageExtension] : []),
      ...getCompletionExtensions(completionSources, completionMode),
      ...(lineWrapping ? [EditorView.lineWrapping] : []),
      ...(additionalExtensions ?? []),
    ],
    [
      ariaLabel,
      ariaLabelledby,
      languageExtension,
      completionSources,
      completionMode,
      lineWrapping,
      additionalExtensions,
    ]
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
        theme={themeOverride ?? editorTheme}
        value={value}
        height={height}
        extensions={extensions}
        onChange={onChange}
        basicSetup={basicSetup}
        indentWithTab={indentWithTab}
        readOnly={readOnly}
        editable={!readOnly}
      />
    </>
  );
});
