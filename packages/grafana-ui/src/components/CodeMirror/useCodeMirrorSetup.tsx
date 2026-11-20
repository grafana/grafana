import { acceptCompletion } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import { type ReactCodeMirrorProps, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { type ReactNode, type RefObject, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';

import { adaptSignatureHelp, adaptSyntaxHighlighting } from './providerAdapters';
import { signatureHelp } from './signatureHelp';
import { createCodeEditorTheme } from './theme';
import { isThemeOverrides } from './themeOverrides';
import { type BaseCodeEditorProps, type CodeMirrorExtension } from './types';
import { useCompletionExtensions } from './useCompletionExtensions';
import { useLanguageExtension } from './useLanguageExtension';
import { useShallowStable, useStableCallback } from './useStableProps';

export interface CodeMirrorSetup {
  /** Pass as `ref` to `@uiw/react-codemirror`. */
  ref: RefObject<ReactCodeMirrorRef | null>;
  /** Spread onto `@uiw/react-codemirror`. */
  props: ReactCodeMirrorProps;
  /** Render above the editor; set when the language fails to load. */
  languageAlert: ReactNode;
}

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

/**
 * Builds the props for `@uiw/react-codemirror` with Grafana's theme, language
 * loading, completion and keyboard behavior.
 */
export function useCodeMirrorSetup(props: BaseCodeEditorProps): CodeMirrorSetup {
  const {
    value,
    language,
    syntaxHighlighting,
    sqlDialect,
    height = '200px',
    onChange,
    onBlur,
    onSave,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    signatureHelp: signatureHelpProvider,
    publicSignatureHelp,
    placeholder,
    extensions: additionalExtensionsProp,
    theme: themeProp,
    basicSetup: basicSetupProp,
    indentWithTab = true,
    readOnly = false,
    lineWrapping = false,
  } = props;
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
  const basicSetup = useShallowStable(basicSetupProp);

  const completionExtensions = useCompletionExtensions(props);
  const syntaxHighlightingExtension = useMemo(
    () => (syntaxHighlighting ? [adaptSyntaxHighlighting(syntaxHighlighting)] : []),
    [syntaxHighlighting]
  );
  const signatureHelpExtension = useMemo(() => {
    const provider = publicSignatureHelp ? adaptSignatureHelp(publicSignatureHelp) : signatureHelpProvider;
    return provider ? [signatureHelp(provider, { theme })] : [];
  }, [signatureHelpProvider, publicSignatureHelp, theme]);

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
      ...syntaxHighlightingExtension,
      ...completionExtensions,
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
      syntaxHighlightingExtension,
      completionExtensions,
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
