import { acceptCompletion, autocompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { memo, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { signatureHelp } from './signatureHelp';
import { createCodeEditorTheme } from './theme';
import {
  type CodeMirrorCompletionMode,
  type CodeMirrorCompletionSource,
  type CodeMirrorEditorProps,
  type CodeMirrorEditorTheme,
  type CodeMirrorExtension,
  type CodeMirrorThemeOverrides,
} from './types';
import { useLanguageExtension } from './useLanguageExtension';
import { useShallowStable, useStableCallback } from './useStableProps';
import { createVariableCompletionSource } from './variableCompletion';

function isThemeOverrides(theme: CodeMirrorEditorTheme): theme is CodeMirrorThemeOverrides {
  // CodeMirror extensions are arrays or objects exposing an `extension` property.
  return typeof theme === 'object' && theme !== null && !Array.isArray(theme) && !('extension' in theme);
}

const getCompletionExtensions = (
  sources: readonly CodeMirrorCompletionSource[] | undefined,
  mode: CodeMirrorCompletionMode,
  completeOnSpace: boolean
): CodeMirrorExtension[] => {
  if (!sources || sources.length === 0) {
    return [];
  }

  const spaceKeymap = completeOnSpace ? [autocompleteSpaceKeymap] : [];

  if (mode === 'override') {
    return [autocompletion({ override: [...sources] }), ...spaceKeymap];
  }

  // Merge: enable autocompletion and contribute the sources via language data
  // so they're combined with whatever the active language registers.
  return [
    autocompletion(),
    ...spaceKeymap,
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
  onBlur,
  onSave,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  completionSources,
  completionMode = 'merge',
  completeOnSpace = false,
  extensions: additionalExtensionsProp,
  theme: themeProp,
  basicSetup: basicSetupProp,
  indentWithTab = true,
  readOnly = false,
  lineWrapping = false,
}: CodeMirrorEditorProps) {
  const theme = useTheme2();
  const { extension: languageExtension, error: languageExtensionError } = useLanguageExtension(language, sqlDialect);
  const themeOverride = useShallowStable(themeProp);
  const editorTheme = useMemo(
    () =>
      themeOverride == null || isThemeOverrides(themeOverride)
        ? createCodeEditorTheme(theme, themeOverride ?? undefined)
        : themeOverride,
    [theme, themeOverride]
  );

  // A new identity on any of these reconfigures the whole editor — see useStableProps.
  const extensionConfig = useShallowStable(additionalExtensionsProp);
  const additionalExtensions = useMemo(() => {
    if (typeof extensionConfig !== 'function') {
      return extensionConfig;
    }
    return extensionConfig({
      theme,
      signatureHelp: (provider) => signatureHelp(provider, { theme }),
      variableCompletion: (suggestions, options) =>
        getCompletionExtensions([createVariableCompletionSource(suggestions, options)], 'merge', completeOnSpace),
    });
  }, [extensionConfig, theme, completeOnSpace]);
  const sources = useShallowStable(completionSources);
  const basicSetup = useShallowStable(basicSetupProp);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const handleChange = useStableCallback(onChange);
  const handleBlur = useStableCallback(() => {
    const editorView = editorRef.current?.view;
    if (editorView) {
      onBlur?.(editorView.state.doc.toString());
    }
  });
  const hasSaveHandler = Boolean(onSave);
  const handleSave = useStableCallback((view: EditorView) => {
    onSave?.(view.state.doc.toString());
    return true;
  });

  const extensions = useMemo(
    () => [
      autocompleteTabKeymap,
      ...(hasSaveHandler ? [keymap.of([{ key: 'Mod-s', run: handleSave, preventDefault: true }])] : []),
      ...getAccessibilityExtensions(ariaLabel, ariaLabelledby),
      ...(languageExtension ? [languageExtension] : []),
      ...getCompletionExtensions(sources, completionMode, completeOnSpace),
      ...(lineWrapping ? [EditorView.lineWrapping] : []),
      ...(additionalExtensions ?? []),
    ],
    [
      hasSaveHandler,
      handleSave,
      ariaLabel,
      ariaLabelledby,
      languageExtension,
      sources,
      completionMode,
      completeOnSpace,
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
        ref={editorRef}
        theme={editorTheme}
        value={value}
        height={height}
        extensions={extensions}
        onChange={handleChange}
        onBlur={onBlur ? handleBlur : undefined}
        basicSetup={basicSetup}
        indentWithTab={indentWithTab}
        readOnly={readOnly}
      />
    </>
  );
});
