import { acceptCompletion, autocompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import { type ReactCodeMirrorProps, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { type ReactNode, type RefObject, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { signatureHelp } from './signatureHelp';
import { createCodeEditorTheme } from './theme';
import {
  type CodeMirrorCompletionMode,
  type CodeMirrorCompletionSource,
  type CodeMirrorEditorSetupProps,
  type CodeMirrorExtension,
  type CodeMirrorThemeOverrides,
} from './types';
import { useLanguageExtension } from './useLanguageExtension';
import { useShallowStable, useStableCallback } from './useStableProps';
import { createVariableCompletionSource } from './variableCompletion';

export interface CodeMirrorSetup {
  /** Pass as `ref` to `@uiw/react-codemirror`. */
  ref: RefObject<ReactCodeMirrorRef | null>;
  /** Spread onto `@uiw/react-codemirror`. */
  props: ReactCodeMirrorProps;
  /** Render above the editor; set when the language fails to load. */
  languageAlert: ReactNode;
}

/**
 * Whether `theme` is plain style overrides. CodeMirror extensions, from any copy
 * of CodeMirror, are arrays or objects exposing an `extension` property.
 */
export function isThemeOverrides(theme: unknown): theme is CodeMirrorThemeOverrides {
  return typeof theme === 'object' && theme !== null && !Array.isArray(theme) && !('extension' in theme);
}

const getCompletionExtensions = (
  sources: readonly CodeMirrorCompletionSource[],
  mode: CodeMirrorCompletionMode,
  completeOnSpace: boolean
): CodeMirrorExtension[] => {
  if (sources.length === 0) {
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

/**
 * Builds the props for `@uiw/react-codemirror` with Grafana's theme, language
 * loading, completion and keyboard behavior. Shared by `CodeMirrorEditor` and the
 * core-only editor so both stay identical apart from raw extensions.
 */
export function useCodeMirrorSetup({
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
  variableSuggestions: variableSuggestionsProp,
  variableCompletionOptions: variableCompletionOptionsProp,
  signatureHelp: signatureHelpProvider,
  placeholder,
  extensions: additionalExtensionsProp,
  theme: themeProp,
  basicSetup: basicSetupProp,
  indentWithTab = true,
  readOnly = false,
  lineWrapping = false,
}: CodeMirrorEditorSetupProps): CodeMirrorSetup {
  const theme = useTheme2();
  const { extension: languageExtension, error: languageExtensionError } = useLanguageExtension(language, sqlDialect);
  const themeOverride = useShallowStable(themeProp);
  const editorTheme = useMemo(
    () =>
      themeOverride === undefined || isThemeOverrides(themeOverride)
        ? createCodeEditorTheme(theme, themeOverride)
        : themeOverride,
    [theme, themeOverride]
  );

  // A new identity on any of these reconfigures the whole editor — see useStableProps.
  const additionalExtensions = useShallowStable(additionalExtensionsProp);
  const sources = useShallowStable(completionSources);
  const variableSuggestions = useShallowStable(variableSuggestionsProp);
  const variableCompletionOptions = useShallowStable(variableCompletionOptionsProp);
  const basicSetup = useShallowStable(basicSetupProp);

  const allSources = useMemo(
    () => [
      ...(sources ?? []),
      ...(variableSuggestions?.length
        ? [createVariableCompletionSource(variableSuggestions, variableCompletionOptions)]
        : []),
    ],
    [sources, variableSuggestions, variableCompletionOptions]
  );
  const signatureHelpExtension = useMemo(
    () => (signatureHelpProvider ? [signatureHelp(signatureHelpProvider, { theme })] : []),
    [signatureHelpProvider, theme]
  );

  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const handleChange = useStableCallback(onChange);
  const handleBlur = useStableCallback(() => {
    const editorView = editorRef.current?.view;
    if (editorView) {
      onBlur?.(editorView.state.doc.toString());
    }
  });
  const handleSave = useStableCallback((view: EditorView) => {
    onSave?.(view.state.doc.toString());
    return true;
  });

  const extensions = useMemo(
    () => [
      autocompleteTabKeymap,
      keymap.of([{ key: 'Mod-s', run: handleSave, preventDefault: true }]),
      ...getAccessibilityExtensions(ariaLabel, ariaLabelledby),
      ...(languageExtension ? [languageExtension] : []),
      ...getCompletionExtensions(allSources, completionMode, completeOnSpace),
      ...(lineWrapping ? [EditorView.lineWrapping] : []),
      ...(placeholder ? [placeholderExtension(placeholder)] : []),
      ...signatureHelpExtension,
      ...(additionalExtensions ?? []),
    ],
    [
      handleSave,
      ariaLabel,
      ariaLabelledby,
      languageExtension,
      allSources,
      completionMode,
      completeOnSpace,
      lineWrapping,
      placeholder,
      signatureHelpExtension,
      additionalExtensions,
    ]
  );

  return {
    ref: editorRef,
    props: {
      theme: editorTheme,
      value,
      height,
      extensions,
      onChange: handleChange,
      onBlur: onBlur ? handleBlur : undefined,
      basicSetup,
      indentWithTab,
      readOnly,
    },
    languageAlert: languageExtensionError ? (
      <Alert title={t('grafana-ui.code-mirror.language-load-failed', 'Syntax highlighting failed to load')}>
        {t(
          'grafana-ui.code-mirror.language-load-failed-description',
          'The editor will continue without language-specific features.'
        )}
      </Alert>
    ) : null,
  };
}
